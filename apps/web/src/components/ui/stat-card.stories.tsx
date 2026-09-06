import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect } from "storybook/test";

import { StatCard } from "./stat-card";

const meta = {
  title: "UI/StatCard",
  component: StatCard,
  tags: ["ai-generated"],
  args: {
    icon: "book",
    label: "Total books",
    value: 128,
    caption: "in your library",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["default", "compact"] },
    iconTone: { control: "inline-radio", options: ["primary", "ink"] },
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("128")).toBeVisible();
    await expect(canvas.getByText("Total books")).toBeVisible();
  },
};

export const TrendUp: Story = {
  args: {
    label: "Books read",
    value: 32,
    caption: undefined,
    trend: { direction: "up", label: "8 more than last year" },
  },
};

export const TrendDown: Story = {
  args: {
    icon: "file",
    label: "Pages per day",
    value: 38,
    caption: undefined,
    trend: { direction: "down", label: "6 fewer than last year" },
  },
};

export const IconAccent: Story = {
  args: { icon: "bookmark", iconTone: "ink", label: "Reading now", value: 3, caption: "books" },
};

export const Clickable: Story = {
  args: {
    icon: "star",
    label: "Average rating",
    value: "4.6",
    caption: "view ratings →",
    onClick: () => undefined,
  },
};

export const WithFooter: Story = {
  args: {
    icon: "wallet",
    label: "Spent",
    value: "40,008 UAH",
    caption: "Other: 170.4 EUR",
    microfact: "3 orders with no known amount",
    footer: <span className="text-xs text-muted-foreground">↑ 163.9% · was 15,162 UAH</span>,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("↑ 163.9% · was 15,162 UAH")).toBeVisible();
  },
};

export const Compact: Story = {
  args: { icon: "bookmark", label: "In queue", value: 12, caption: "to read", size: "compact" },
};

export const Grid: Story = {
  decorators: [
    (Story) => (
      <div className="w-[60rem]">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(14.5rem,1fr))] gap-[18px]">
      <StatCard caption="in your library" icon="book" label="Total books" value={128} />
      <StatCard caption="books" icon="bookmark" iconTone="ink" label="Reading now" value={3} />
      <StatCard
        icon="book"
        label="Books read"
        trend={{ direction: "up", label: "8 more than last year" }}
        value={32}
      />
      <StatCard
        icon="file"
        label="Pages read"
        trend={{ direction: "up", label: "2,310 more than last year" }}
        value="12,450"
      />
    </div>
  ),
};
