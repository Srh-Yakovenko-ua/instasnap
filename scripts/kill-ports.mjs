import { execFileSync } from "node:child_process";
import process from "node:process";

function killPosix(port) {
  const pids = run("lsof", ["-ti", `:${port}`])
    .split("\n")
    .filter(Boolean);
  for (const pid of pids) run("kill", ["-9", pid]);
  return pids.length;
}

function killWindows(port) {
  const listening = run("netstat", ["-ano", "-p", "tcp"])
    .split("\n")
    .filter((line) => line.includes("LISTENING") && line.includes(`:${port} `));
  const pids = [...new Set(listening.map((line) => line.trim().split(/\s+/).at(-1)))].filter(
    (pid) => pid !== undefined && pid !== "0",
  );
  for (const pid of pids) run("taskkill", ["/PID", pid, "/F", "/T"]);
  return pids.length;
}

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

const killers = {
  darwin: killPosix,
  linux: killPosix,
  win32: killWindows,
};

const kill = killers[process.platform] ?? killPosix;

for (const port of process.argv.slice(2)) {
  const freed = kill(port);
  if (freed > 0) process.stdout.write(`freed port ${port} (${freed} process(es))\n`);
}
