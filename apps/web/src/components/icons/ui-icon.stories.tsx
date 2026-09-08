import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, waitFor } from "storybook/test";

import { UiIcon, type UiIconName } from "./ui-icon";

const ALL_UI_ICONS: readonly UiIconName[] = [
  "home",
  "library",
  "library-big",
  "book",
  "list",
  "layers",
  "cart",
  "truck",
  "heart",
  "note",
  "quote",
  "user",
  "building",
  "tag",
  "chart",
  "chart-increasing",
  "target",
  "calendar",
  "settings",
  "swap",
  "arrow-down-circle",
  "arrow-up-right",
  "panel",
  "search",
  "bell",
  "sun",
  "moon",
  "monitor",
  "sliders",
  "filter",
  "funnel",
  "plus",
  "minus",
  "edit",
  "trash",
  "check",
  "x",
  "more",
  "refresh",
  "share",
  "external",
  "link",
  "copy",
  "crown",
  "download",
  "upload",
  "bookmark",
  "grip",
  "eye",
  "eye-off",
  "chevron-up",
  "chevron-down",
  "chevron-left",
  "chevron-right",
  "arrow-up",
  "arrow-down",
  "arrow-left",
  "arrow-right",
  "tablet",
  "headphones",
  "check-circle",
  "alert-triangle",
  "x-circle",
  "info",
  "alert-circle",
  "circle-slash",
  "help-circle",
  "clock",
  "flame",
  "trophy",
  "package",
  "store",
  "shopping-bag",
  "wallet",
  "pie",
  "pages",
  "sessions",
  "file",
  "trend-up",
  "trend-down",
  "palette",
  "globe",
  "lock",
  "shield",
  "ruler",
  "mail",
  "google",
  "at",
  "phone",
  "camera",
  "image",
  "cloud-up",
  "login",
  "logout",
  "menu",
  "star",
  "star-fill",
  "sparkles",
  "leaf",
  "sprig",
  "bulb",
  "type",
  "hash",
  "check-square",
];

const COMMON_UI_ICONS: readonly UiIconName[] = [
  "home",
  "library",
  "book",
  "list",
  "search",
  "plus",
  "minus",
  "edit",
  "trash",
  "check",
  "x",
  "more",
  "filter",
  "funnel",
  "sliders",
  "settings",
  "user",
  "heart",
  "bookmark",
  "star",
  "bell",
  "calendar",
  "clock",
  "tag",
  "share",
  "link",
  "download",
  "upload",
  "chevron-down",
  "chevron-right",
  "refresh",
];

function IconGrid({ names }: { names: readonly UiIconName[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2 text-foreground">
      {names.map((name) => (
        <div
          className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3"
          key={name}
        >
          <UiIcon name={name} size={24} />
          <span className="truncate text-[10px] text-muted-foreground">{name}</span>
        </div>
      ))}
    </div>
  );
}

const meta = {
  args: {
    name: "book",
    size: 24,
  },
  argTypes: {
    name: {
      control: "select",
      options: ALL_UI_ICONS,
    },
    size: { control: { type: "number" } },
  },
  component: UiIcon,
  tags: ["ai-generated"],
  title: "Icons/UiIcon",
} satisfies Meta<typeof UiIcon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Single: Story = {};

export const Titled: Story = {
  args: { name: "heart", title: "Favorites" },
  play: async ({ canvas }) => {
    const icon = canvas.getByRole("img", { name: "Favorites" });
    const use = icon.querySelector("use");
    await expect(use).toHaveAttribute("href", "/icons/ui-icons.svg#i-heart");
  },
};

export const Common: Story = {
  render: () => <IconGrid names={COMMON_UI_ICONS} />,
};

export const All: Story = {
  play: async ({ canvasElement }) => {
    const uses = canvasElement.querySelectorAll<SVGUseElement>("use");
    await expect(uses.length).toBe(ALL_UI_ICONS.length);

    await waitFor(() => {
      const unresolved = [...uses].filter((use) => {
        const bb = use.getBBox();
        return bb.width <= 0 && bb.height <= 0;
      });
      expect(unresolved).toHaveLength(0);
    });

    const failing = [...uses]
      .filter((use) => {
        const bb = use.getBBox();
        return !(bb.width > 0 || bb.height > 0);
      })
      .map((use) => use.getAttribute("href") ?? "(missing href)");
    await expect(failing).toEqual([]);
  },
  render: () => <IconGrid names={ALL_UI_ICONS} />,
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-4 text-foreground">
      <UiIcon name="sparkles" size={16} />
      <UiIcon name="sparkles" size={20} />
      <UiIcon name="sparkles" size={24} />
      <UiIcon name="sparkles" size={32} />
      <UiIcon name="sparkles" size={48} />
    </div>
  ),
};

export const Colors: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <UiIcon className="text-primary" name="heart" size={28} />
      <UiIcon className="text-icon" name="bookmark" size={28} />
      <UiIcon className="text-muted-foreground" name="star" size={28} />
      <UiIcon className="text-foreground" name="flame" size={28} />
    </div>
  ),
};
