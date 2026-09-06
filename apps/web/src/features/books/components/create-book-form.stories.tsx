import type { AuthorView, SeriesView } from "@app/shared";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { getQueryClient } from "@/lib/query-client";
import messages from "@/messages/uk.json";

import { CreateBookForm } from "./create-book-form";

type Handler = (path: string, init?: RequestInit) => Promise<Response> | Response;

function emptyPage(pageSize: number) {
  return jsonResponse(200, {
    items: [],
    page: 1,
    pagesCount: 0,
    pageSize,
    totalCount: 0,
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockFetch(handler: Handler) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const path = typeof input === "string" ? input : input.toString();
    return Promise.resolve(handler(path, init));
  }) as typeof fetch;
}

const emptyAuthorSearch = emptyPage(8);

const GENRES_FIXTURE = [
  { groupKey: "fiction", groupName: "Художня література", key: "fantasy", name: "Фентезі" },
  {
    groupKey: "fiction",
    groupName: "Художня література",
    key: "science_fiction",
    name: "Наукова фантастика",
  },
  { groupKey: "fiction", groupName: "Художня література", key: "romance", name: "Романтика" },
  { groupKey: "fiction", groupName: "Художня література", key: "thriller", name: "Трилер" },
  { groupKey: "fiction", groupName: "Художня література", key: "detective", name: "Детектив" },
  { groupKey: "fiction", groupName: "Художня література", key: "horror", name: "Жахи" },
].map((genre, index) => ({ ...genre, id: `genre-${index}`, isDefault: true }));

function taxonomyHandler(extra?: Handler): Handler {
  return (path, init) => {
    if (path.includes("/api/publishers/recent")) return jsonResponse(200, []);
    if (path.includes("/api/books/purchase-stores")) return jsonResponse(200, []);
    if (path.includes("/api/genres") && (init?.method ?? "GET") === "GET") {
      return jsonResponse(200, GENRES_FIXTURE);
    }
    if (path.includes("/api/tags") && (init?.method ?? "GET") === "GET") {
      return jsonResponse(200, {
        items: [
          { id: "tag-1", name: "улюблене" },
          { id: "tag-2", name: "подарунок" },
        ],
        page: 1,
        pagesCount: 1,
        pageSize: 20,
        totalCount: 2,
      });
    }
    if (path.includes("/api/authors/recent")) return jsonResponse(200, []);
    if (path.includes("/api/series") && init?.method !== "POST") return emptyPage(8);
    if (path.includes("/api/lists") && init?.method !== "POST") {
      return jsonResponse(200, {
        items: [
          { description: null, id: "list-1", name: "Літнє читання" },
          { description: "подарунки", id: "list-2", name: "Подарунки" },
        ],
        page: 1,
        pagesCount: 1,
        pageSize: 50,
        totalCount: 2,
      });
    }
    if (path.includes("/api/authors")) return emptyAuthorSearch;
    return extra?.(path, init) ?? emptyAuthorSearch;
  };
}

const meta = {
  beforeEach: () => {
    mockFetch(taxonomyHandler());
  },
  component: CreateBookForm,
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-5xl p-6">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
  },
  tags: ["ai-generated"],
  title: "Books/CreateBookForm",
} satisfies Meta<typeof CreateBookForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Назва")).toBeVisible();
    await expect(canvas.getByLabelText("Автор")).toBeVisible();
    await expect(canvas.getByText("Приклад назви")).toBeVisible();
    await expect(canvas.getByRole("button", { name: /Додати книгу/ })).toBeVisible();
  },
};

export const ValidationOnEmptySubmit: Story = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());
    await userEvent.click(canvas.getByRole("button", { name: /Додати книгу/ }));
    await waitFor(async () => {
      const alerts = await canvas.findAllByRole("alert");
      await expect(alerts.length).toBeGreaterThan(0);
    });
  },
};

export const PreviewUpdatesLive: Story = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());
    const titleInput = canvas.getByLabelText("Назва");
    await userEvent.type(titleInput, "Місто");
    await expect(canvas.getByRole("heading", { name: "Місто" })).toBeVisible();
  },
};

export const SuccessfulCreate: Story = {
  play: async ({ canvas }) => {
    let createPayload: unknown = null;
    mockFetch(
      taxonomyHandler((path, init) => {
        if (path.includes("/api/books") && init?.method === "POST") {
          createPayload = JSON.parse(String(init.body));
          return jsonResponse(201, {});
        }
        return emptyAuthorSearch;
      }),
    );

    await userEvent.type(canvas.getByLabelText("Назва"), "Тіні забутих предків");

    const authorInput = canvas.getByLabelText("Автор");
    await userEvent.click(authorInput);
    await userEvent.type(authorInput, "Михайло Коцюбинський");

    const surface = within(document.body);
    const custom = await surface.findByText(/^Створити «/);
    await userEvent.click(custom);

    await userEvent.click(canvas.getByRole("button", { name: /Додати книгу/ }));

    await waitFor(() => expect(createPayload).not.toBeNull());
    await expect(createPayload).toMatchObject({
      authors: [{ name: "Михайло Коцюбинський" }],
      deliveryInfo: {},
      loanInfo: {},
      purchaseInfo: {},
      readingProgress: {},
      title: "Тіні забутих предків",
    });
  },
};

export const FinishedRevealsRatingAndImpression: Story = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());

    await userEvent.click(canvas.getByRole("radio", { name: "Прочитано" }));

    await expect(canvas.getByLabelText("Дата завершення")).toBeVisible();
    await expect(canvas.getByLabelText("Враження")).toBeVisible();
    await expect(canvas.getByRole("slider", { name: "Оцінка" })).toBeVisible();

    await expect(canvas.queryByLabelText("Сторінка зараз")).toBeNull();
  },
};

export const BorrowedRequiresPersonName: Story = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());

    await userEvent.click(canvas.getByRole("radio", { name: "Позичена у когось" }));
    await expect(canvas.getByLabelText("Імʼя людини")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: /Додати книгу/ }));

    await waitFor(async () => {
      await expect(canvas.getByText(messages.loans.contactPicker.required)).toBeVisible();
    });
  },
};

export const SwitchingStatusPrunesPayload: Story = {
  play: async ({ canvas }) => {
    let createPayload: unknown = null;
    mockFetch(
      taxonomyHandler((path, init) => {
        if (path.includes("/api/books") && init?.method === "POST") {
          createPayload = JSON.parse(String(init.body));
          return jsonResponse(201, {});
        }
        return emptyAuthorSearch;
      }),
    );

    await userEvent.type(canvas.getByLabelText("Назва"), "Зачарована Десна");

    const authorInput = canvas.getByLabelText("Автор");
    await userEvent.click(authorInput);
    await userEvent.type(authorInput, "Олександр Довженко");
    const surface = within(document.body);
    await userEvent.click(await surface.findByText(/^Створити «/));

    await userEvent.click(canvas.getByRole("radio", { name: "Прочитано" }));
    await userEvent.click(canvas.getByRole("slider", { name: "Оцінка" }));
    await userEvent.type(canvas.getByLabelText("Враження"), "Дуже зворушливо");

    await userEvent.click(canvas.getByRole("radio", { name: "Читаю" }));
    await expect(canvas.queryByLabelText("Враження")).toBeNull();

    await userEvent.click(canvas.getByRole("button", { name: /Додати книгу/ }));

    await waitFor(() => expect(createPayload).not.toBeNull());
    await expect(createPayload).toMatchObject({
      readingStatus: "reading",
      title: "Зачарована Десна",
    });
    const readingProgress = (createPayload as { readingProgress: Record<string, unknown> })
      .readingProgress;
    await expect(readingProgress.rating).toBeUndefined();
    await expect(readingProgress.impression).toBeUndefined();
  },
};

export const FormatMultiSelect: Story = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());

    const paper = canvas.getByRole("button", { name: "Паперова", pressed: true });
    const audiobook = canvas.getByRole("button", { name: "Аудіокнига", pressed: false });

    await userEvent.click(audiobook);
    await userEvent.click(paper);

    await expect(canvas.getByRole("button", { name: "Паперова", pressed: false })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Аудіокнига", pressed: true })).toBeVisible();
  },
};

export const GenresCappedAtFive: Story = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());
    const surface = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: "Оберіть жанри" }));

    for (const label of ["Фентезі", "Наукова фантастика", "Романтика", "Трилер", "Детектив"]) {
      await userEvent.click(await surface.findByText(label));
    }

    await waitFor(async () => {
      const removable = await canvas.findAllByRole("button", { name: /^Прибрати/ });
      await expect(removable).toHaveLength(5);
    });

    await expect(surface.queryByText("Жахи")).toBeNull();
  },
};

export const TagsDedupeCaseInsensitive: Story = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());

    const tagsInput = canvas.getByLabelText("Теги");
    await userEvent.type(tagsInput, "Фантастика{enter}");
    await userEvent.type(tagsInput, "фАнТаСтИкА{enter}");

    await waitFor(async () => {
      const chips = await canvas.findAllByRole("button", { name: /^Видалити тег/ });
      await expect(chips).toHaveLength(1);
    });
  },
};

export const TagSuggestionAddsExisting: Story = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());
    const surface = within(document.body);

    await userEvent.click(canvas.getByLabelText("Теги"));
    const suggestion = await surface.findByRole("option", { name: /улюблене/ });
    await userEvent.click(suggestion);

    await waitFor(async () => {
      await expect(canvas.getByRole("button", { name: "Видалити тег «улюблене»" })).toBeVisible();
    });
  },
};

export const DeleteSavedTagFromSuggestions: Story = {
  play: async ({ canvas }) => {
    let deletedTagPath: null | string = null;
    mockFetch(
      taxonomyHandler((path, init) => {
        if (path.includes("/api/tags/") && init?.method === "DELETE") {
          deletedTagPath = path;
          return jsonResponse(204, null);
        }
        return emptyAuthorSearch;
      }),
    );
    const surface = within(document.body);

    await userEvent.click(canvas.getByLabelText("Теги"));
    const deleteControl = await surface.findByRole("button", {
      name: "Видалити збережений тег «улюблене»",
    });
    await userEvent.click(deleteControl);

    const dialog = within(await surface.findByRole("alertdialog"));
    await expect(dialog.getByText("Видалити тег?")).toBeVisible();

    await userEvent.click(dialog.getByRole("button", { name: "Видалити тег" }));

    await waitFor(() => expect(deletedTagPath).not.toBeNull());
    await expect(deletedTagPath).toContain("/api/tags/tag-1");
  },
};

export const TagShorterThanTwoCharsRejected: Story = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());

    const tagsInput = canvas.getByLabelText("Теги");
    await userEvent.type(tagsInput, "a{enter}");

    await waitFor(async () => {
      await expect(canvas.getByText("Тег має містити щонайменше 2 символи.")).toBeVisible();
    });
    await expect(canvas.queryByRole("button", { name: /^Видалити тег/ })).toBeNull();
  },
};

export const SeriesModalStatusIsChipGroup: Story = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());
    const surface = within(document.body);

    await userEvent.click(canvas.getByRole("radio", { name: "Частина серії" }));

    const seriesInput = canvas.getByLabelText("Серія");
    await userEvent.click(seriesInput);
    await userEvent.type(seriesInput, "Відьмак");
    await userEvent.click(await surface.findByText(/Створити «Відьмак»/));

    const dialog = within(await surface.findByRole("dialog"));
    await expect(dialog.getByRole("radio", { checked: true, name: "Невідомо" })).toBeVisible();
    await userEvent.click(dialog.getByRole("radio", { name: "Завершено" }));
    await expect(dialog.getByRole("radio", { checked: true, name: "Завершено" })).toBeVisible();
  },
};

export const SeriesPartRevealsFields: Story = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());

    await expect(canvas.queryByLabelText("Серія")).toBeNull();

    await userEvent.click(canvas.getByRole("radio", { name: "Частина серії" }));

    await expect(canvas.getByLabelText("Серія")).toBeVisible();
    await expect(canvas.getByLabelText("Номер у серії")).toBeVisible();
  },
};

export const CreateSeriesModalSetsNewSeries: Story = {
  play: async ({ canvas }) => {
    let createPayload: unknown = null;
    mockFetch(
      taxonomyHandler((path, init) => {
        if (path.includes("/api/books") && init?.method === "POST") {
          createPayload = JSON.parse(String(init.body));
          return jsonResponse(201, {});
        }
        return emptyAuthorSearch;
      }),
    );
    const surface = within(document.body);

    await userEvent.type(canvas.getByLabelText("Назва"), "Останнє бажання");

    const authorInput = canvas.getByLabelText("Автор");
    await userEvent.click(authorInput);
    await userEvent.type(authorInput, "Анджей Сапковський");
    await userEvent.click(await surface.findByText(/^Створити «/));

    await userEvent.click(canvas.getByRole("radio", { name: "Частина серії" }));

    const seriesInput = canvas.getByLabelText("Серія");
    await userEvent.click(seriesInput);
    await userEvent.type(seriesInput, "Відьмак");

    await userEvent.click(await surface.findByText(/Створити «Відьмак»/));

    const dialog = within(await surface.findByRole("dialog"));
    await expect(dialog.getByLabelText("Назва серії")).toHaveValue("Відьмак");
    await userEvent.click(dialog.getByRole("button", { name: "Створити серію" }));

    await waitFor(() => expect(surface.queryByRole("dialog")).toBeNull());
    await expect(await surface.findByText(/Нова серія «Відьмак»/)).toBeVisible();

    await userEvent.click(await surface.findByRole("button", { name: /Додати книгу/ }));

    await waitFor(() => expect(createPayload).not.toBeNull());
    const payload = createPayload as {
      bookType: string;
      newSeries?: { name: string };
      partNumber?: number;
      seriesId?: string;
    };
    await expect(payload.bookType).toBe("series_part");
    await expect(payload.newSeries?.name).toBe("Відьмак");
    await expect(payload.partNumber).toBe(1);
    await expect(payload.seriesId).toBeUndefined();
  },
};

export const SeriesPartNumberConflictShowsLink: Story = {
  play: async ({ canvas }) => {
    mockFetch(
      taxonomyHandler((path, init) => {
        if (path.includes("/api/books") && init?.method === "POST") {
          return jsonResponse(400, {
            errorsMessages: [
              {
                code: "book_series_part_number_taken",
                field: "partNumber",
                message: "A book with this part number already exists in this series",
                meta: {
                  bookId: "book-iron-flame",
                  bookTitle: "Iron Flame",
                  partNumber: "1",
                },
              },
            ],
          });
        }
        return emptyAuthorSearch;
      }),
    );
    const surface = within(document.body);

    await userEvent.type(canvas.getByLabelText("Назва"), "Залізне полум'я");

    const authorInput = canvas.getByLabelText("Автор");
    await userEvent.click(authorInput);
    await userEvent.type(authorInput, "Ребекка Яррос");
    await userEvent.click(await surface.findByText(/^Створити «/));

    await userEvent.click(canvas.getByRole("radio", { name: "Частина серії" }));

    const seriesInput = canvas.getByLabelText("Серія");
    await userEvent.click(seriesInput);
    await userEvent.type(seriesInput, "Емпіреї");
    await userEvent.click(await surface.findByText(/Створити «Емпіреї»/));
    const dialog = within(await surface.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Створити серію" }));
    await waitFor(() => expect(surface.queryByRole("dialog")).toBeNull());

    await userEvent.click(await surface.findByRole("button", { name: /Додати книгу/ }));

    await expect(await surface.findByText(/уже зайнятий книгою «Iron Flame»/)).toBeVisible();
    const link = await surface.findByRole("link", { name: "Відкрити книгу" });
    await expect(link.getAttribute("href")).toContain("/books/book-iron-flame/edit");
    await expect(link.getAttribute("target")).toBe("_blank");
    await expect(link.getAttribute("rel")).toContain("noopener");
  },
};

export const SoloClearsSeriesFields: Story = {
  play: async ({ canvas }) => {
    let createPayload: unknown = null;
    mockFetch(
      taxonomyHandler((path, init) => {
        if (path.includes("/api/books") && init?.method === "POST") {
          createPayload = JSON.parse(String(init.body));
          return jsonResponse(201, {});
        }
        return emptyAuthorSearch;
      }),
    );
    const surface = within(document.body);

    await userEvent.type(canvas.getByLabelText("Назва"), "Кров ельфів");

    const authorInput = canvas.getByLabelText("Автор");
    await userEvent.click(authorInput);
    await userEvent.type(authorInput, "Анджей Сапковський");
    await userEvent.click(await surface.findByText(/^Створити «/));

    await userEvent.click(canvas.getByRole("radio", { name: "Частина серії" }));
    const seriesInput = canvas.getByLabelText("Серія");
    await userEvent.click(seriesInput);
    await userEvent.type(seriesInput, "Відьмак");
    await userEvent.click(await surface.findByText(/Створити «Відьмак»/));
    const dialog = within(await surface.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Створити серію" }));
    await waitFor(() => expect(surface.queryByRole("dialog")).toBeNull());
    await expect(await surface.findByText(/Нова серія «Відьмак»/)).toBeVisible();

    await userEvent.click(await surface.findByRole("radio", { name: "Окрема книга" }));
    await expect(surface.queryByLabelText("Серія")).toBeNull();

    await userEvent.click(await surface.findByRole("button", { name: /Додати книгу/ }));

    await waitFor(() => expect(createPayload).not.toBeNull());
    const payload = createPayload as {
      bookType: string;
      newSeries?: unknown;
      partNumber?: unknown;
      seriesId?: unknown;
    };
    await expect(payload.bookType).toBe("solo");
    await expect(payload.newSeries).toBeUndefined();
    await expect(payload.seriesId).toBeUndefined();
    await expect(payload.partNumber).toBeUndefined();
  },
};

export const EditionDetailsSubmitsNumbers: Story = {
  play: async ({ canvas }) => {
    let createPayload: unknown = null;
    mockFetch(
      taxonomyHandler((path, init) => {
        if (path.includes("/api/books") && init?.method === "POST") {
          createPayload = JSON.parse(String(init.body));
          return jsonResponse(201, {});
        }
        return emptyAuthorSearch;
      }),
    );
    const surface = within(document.body);

    await userEvent.type(canvas.getByLabelText("Назва"), "Кобзар");

    const authorInput = canvas.getByLabelText("Автор");
    await userEvent.click(authorInput);
    await userEvent.type(authorInput, "Тарас Шевченко");
    await userEvent.click(await surface.findByText(/^Створити «/));

    await userEvent.type(canvas.getByLabelText("Сторінок", { exact: false }), "320");
    await userEvent.click(canvas.getByRole("button", { name: "Рік видання" }));
    await userEvent.click(await surface.findByRole("button", { name: "2021" }));
    await userEvent.type(canvas.getByLabelText("Оригінальна назва", { exact: false }), "Kobzar");

    await userEvent.click(canvas.getByRole("button", { name: /Додаткові деталі/ }));
    await userEvent.type(canvas.getByLabelText("ISBN", { exact: false }), "9786176790006");

    await userEvent.type(canvas.getByLabelText("Присвята", { exact: false }), "Україні");

    await userEvent.click(canvas.getByRole("button", { name: /Додати книгу/ }));

    await waitFor(() => expect(createPayload).not.toBeNull());
    await expect(createPayload).toMatchObject({
      dedication: "Україні",
      isbn: "9786176790006",
      originalTitle: "Kobzar",
      pagesCount: 320,
      publicationYear: 2021,
      title: "Кобзар",
    });
  },
};

export const NegativeKeysBlockedInNumericFields: Story = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());

    const pagesInput = canvas.getByLabelText("Сторінок", { exact: false });
    await userEvent.type(pagesInput, "-320");
    await expect(pagesInput).toHaveValue(320);

    await userEvent.click(canvas.getByRole("radio", { name: "Читаю" }));
    const currentPage = canvas.getByRole("spinbutton", { name: "Сторінка зараз" });
    await userEvent.click(currentPage);
    await userEvent.keyboard("-");
    await expect(currentPage).toHaveValue("0");
  },
};

export const CurrentPageCannotExceedPages: Story = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());

    await userEvent.type(canvas.getByLabelText("Назва"), "Тигролови");

    await userEvent.click(canvas.getByRole("radio", { name: "Читаю" }));

    await userEvent.type(canvas.getByLabelText("Сторінок", { exact: false }), "1");

    const currentPageGroup = canvas.getByRole("spinbutton", { name: "Сторінка зараз" });
    const increment = within(currentPageGroup.parentElement as HTMLElement).getByRole("button", {
      name: "Збільшити",
    });
    await userEvent.click(increment);
    await userEvent.click(increment);
    await expect(currentPageGroup).toHaveValue("2");

    await userEvent.click(canvas.getByRole("button", { name: /Додати книгу/ }));

    await waitFor(async () => {
      await expect(canvas.getByText("Current page cannot exceed the page count")).toBeVisible();
    });
  },
};

export const QueueToggleRevealsAndClearsPriority: Story = {
  play: async ({ canvas }) => {
    let createPayload: unknown = null;
    mockFetch(
      taxonomyHandler((path, init) => {
        if (path.includes("/api/books") && init?.method === "POST") {
          createPayload = JSON.parse(String(init.body));
          return jsonResponse(201, {});
        }
        return emptyAuthorSearch;
      }),
    );
    const surface = within(document.body);

    await userEvent.type(canvas.getByLabelText("Назва"), "Місто");
    const authorInput = canvas.getByLabelText("Автор");
    await userEvent.click(authorInput);
    await userEvent.type(authorInput, "Валер'ян Підмогильний");
    await userEvent.click(await surface.findByText(/^Створити «/));

    await expect(canvas.queryByRole("radio", { name: "Високий" })).toBeNull();

    const queueSwitch = canvas.getByRole("switch", { name: "Додати до черги читання" });
    await userEvent.click(queueSwitch);

    await expect(canvas.getByRole("radio", { name: "Звичайний" })).toBeVisible();
    await userEvent.click(canvas.getByRole("radio", { name: "Високий" }));

    await userEvent.click(queueSwitch);
    await expect(canvas.queryByRole("radio", { name: "Високий" })).toBeNull();

    await userEvent.click(canvas.getByRole("button", { name: /Додати книгу/ }));

    await waitFor(() => expect(createPayload).not.toBeNull());
    const payload = createPayload as {
      addToReadingQueue: boolean;
      queuePriority?: unknown;
    };
    await expect(payload.addToReadingQueue).toBe(false);
    await expect(payload.queuePriority).toBeUndefined();
  },
};

export const FavoriteAndQueuePrioritySubmit: Story = {
  play: async ({ canvas }) => {
    let createPayload: unknown = null;
    mockFetch(
      taxonomyHandler((path, init) => {
        if (path.includes("/api/books") && init?.method === "POST") {
          createPayload = JSON.parse(String(init.body));
          return jsonResponse(201, {});
        }
        return emptyAuthorSearch;
      }),
    );
    const surface = within(document.body);

    await userEvent.type(canvas.getByLabelText("Назва"), "Сад Гетсиманський");
    const authorInput = canvas.getByLabelText("Автор");
    await userEvent.click(authorInput);
    await userEvent.type(authorInput, "Іван Багряний");
    await userEvent.click(await surface.findByText(/^Створити «/));

    await userEvent.click(canvas.getByRole("switch", { name: "Додати до улюблених" }));
    await userEvent.click(canvas.getByRole("switch", { name: "Додати до черги читання" }));
    await userEvent.click(canvas.getByRole("radio", { name: "Високий" }));

    await userEvent.click(canvas.getByRole("button", { name: /Додати книгу/ }));

    await waitFor(() => expect(createPayload).not.toBeNull());
    await expect(createPayload).toMatchObject({
      addToReadingQueue: true,
      isFavorite: true,
      queuePriority: "high",
    });
  },
};

export const CreateListModalAddsDraft: Story = {
  play: async ({ canvas }) => {
    let createPayload: unknown = null;
    mockFetch(
      taxonomyHandler((path, init) => {
        if (path.includes("/api/books") && init?.method === "POST") {
          createPayload = JSON.parse(String(init.body));
          return jsonResponse(201, {});
        }
        return emptyAuthorSearch;
      }),
    );
    const surface = within(document.body);

    await userEvent.type(canvas.getByLabelText("Назва"), "Польові дослідження");
    const authorInput = canvas.getByLabelText("Автор");
    await userEvent.click(authorInput);
    await userEvent.type(authorInput, "Оксана Забужко");
    await userEvent.click(await surface.findByText(/^Створити «/));

    await userEvent.click(canvas.getByRole("button", { name: "Новий список" }));

    const dialog = within(await surface.findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText("Назва списку"), "Українська проза");
    await userEvent.click(dialog.getByRole("button", { name: "Створити список" }));

    await waitFor(() => expect(surface.queryByRole("dialog")).toBeNull());
    await expect(canvas.getByText("Українська проза")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: /Додати книгу/ }));

    await waitFor(() => expect(createPayload).not.toBeNull());
    const payload = createPayload as { newLists?: { name: string }[] };
    await expect(payload.newLists?.[0]?.name).toBe("Українська проза");
  },
};

export const CreateListSelectsInsideMultiselect: Story = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());
    const surface = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: "Новий список" }));
    const dialog = within(await surface.findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText("Назва списку"), "Українська проза");
    await userEvent.click(dialog.getByRole("button", { name: "Створити список" }));
    await waitFor(() => expect(surface.queryByRole("dialog")).toBeNull());

    await expect(canvas.getByRole("button", { name: "Прибрати Українська проза" })).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Прибрати Українська проза" }));
    await expect(canvas.queryByText("Українська проза")).toBeNull();
  },
};

export const ListDialogSubmitDoesNotSubmitBookForm: Story = {
  play: async ({ canvas }) => {
    let createPayload: unknown = null;
    mockFetch(
      taxonomyHandler((path, init) => {
        if (path.includes("/api/books") && init?.method === "POST") {
          createPayload = JSON.parse(String(init.body));
          return jsonResponse(201, {});
        }
        return emptyAuthorSearch;
      }),
    );
    const surface = within(document.body);

    await userEvent.type(canvas.getByLabelText("Назва"), "Лісова пісня");
    const authorInput = canvas.getByLabelText("Автор");
    await userEvent.click(authorInput);
    await userEvent.type(authorInput, "Леся Українка");
    await userEvent.click(await surface.findByText(/^Створити «/));

    await userEvent.click(canvas.getByRole("button", { name: "Новий список" }));

    const dialog = within(await surface.findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText("Назва списку"), "Класика");
    await userEvent.click(dialog.getByRole("button", { name: "Створити список" }));

    await waitFor(() => expect(surface.queryByRole("dialog")).toBeNull());
    await expect(canvas.getByText("Класика")).toBeVisible();
    await expect(createPayload).toBeNull();
  },
};

export const SeriesDialogSubmitDoesNotSubmitBookForm: Story = {
  play: async ({ canvas }) => {
    let createPayload: unknown = null;
    mockFetch(
      taxonomyHandler((path, init) => {
        if (path.includes("/api/books") && init?.method === "POST") {
          createPayload = JSON.parse(String(init.body));
          return jsonResponse(201, {});
        }
        return emptyAuthorSearch;
      }),
    );
    const surface = within(document.body);

    await userEvent.type(canvas.getByLabelText("Назва"), "Чорна рада");
    const authorInput = canvas.getByLabelText("Автор");
    await userEvent.click(authorInput);
    await userEvent.type(authorInput, "Пантелеймон Куліш");
    await userEvent.click(await surface.findByText(/^Створити «/));

    await userEvent.click(canvas.getByRole("radio", { name: "Частина серії" }));

    const seriesInput = canvas.getByLabelText("Серія");
    await userEvent.click(seriesInput);
    await userEvent.type(seriesInput, "Хроніки");
    await userEvent.click(await surface.findByText(/Створити «Хроніки»/));

    const dialog = within(await surface.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Створити серію" }));

    await waitFor(() => expect(surface.queryByRole("dialog")).toBeNull());
    await expect(await surface.findByText(/Нова серія «Хроніки»/)).toBeVisible();
    await expect(createPayload).toBeNull();
  },
};

export const ListDialogResetsAfterCancel: Story = {
  play: async ({ canvas }) => {
    mockFetch(taxonomyHandler());
    const surface = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: "Новий список" }));
    const firstOpen = within(await surface.findByRole("dialog"));
    await userEvent.type(firstOpen.getByLabelText("Назва списку"), "Чернетка");
    await userEvent.click(firstOpen.getByRole("button", { name: "Скасувати" }));
    await waitFor(() => expect(surface.queryByRole("dialog")).toBeNull());

    await userEvent.click(canvas.getByRole("button", { name: "Новий список" }));
    const secondOpen = within(await surface.findByRole("dialog"));
    await expect(secondOpen.getByLabelText("Назва списку")).toHaveValue("");
  },
};

function authorView(seed: { id: string; name: string }): AuthorView {
  return {
    bio: null,
    birthYear: null,
    countryCode: null,
    deathYear: null,
    id: seed.id,
    isCustom: false,
    name: seed.name,
    openLibraryKey: null,
    photoAttribution: null,
    photoLicense: null,
    photoLicenseUrl: null,
    photoUrl: null,
  };
}

function seriesView(seed: {
  authors: { id: string; name: string }[];
  id: string;
  name: string;
}): SeriesView {
  return {
    ageCategories: [],
    authors: seed.authors,
    averagePages: null,
    averageRating: null,
    booksInSeries: 0,
    covers: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    description: null,
    finishedInSeries: 0,
    formats: [],
    genres: [],
    hasFavoriteBook: false,
    hasPublicationYears: false,
    hasPublisher: false,
    id: seed.id,
    languages: [],
    lastActivityAt: "2026-01-01T00:00:00.000Z",
    missingPartNumbers: [],
    name: seed.name,
    nextBook: null,
    ownership: { ownedCount: 0, total: 0 },
    pagesCount: null,
    readingInSeries: 0,
    status: "ongoing",
    tags: [],
    totalBooks: null,
  };
}

const SAPKOWSKI = { id: "11111111-1111-4111-8111-111111111111", name: "Анджей Сапковський" };

function mockWitcherSeries() {
  getQueryClient().clear();
  const witcher = seriesView({ authors: [SAPKOWSKI], id: "series-witcher", name: "Відьмак" });
  const base = taxonomyHandler();
  mockFetch((path, init) => {
    if (path.includes("/api/authors/recent")) {
      return jsonResponse(200, [authorView(SAPKOWSKI)]);
    }
    if (path.includes("/api/series") && init?.method !== "POST") {
      if (path.includes("authorIds")) {
        return jsonResponse(200, {
          items: [witcher],
          page: 1,
          pagesCount: 1,
          pageSize: 20,
          totalCount: 1,
        });
      }
      return emptyPage(20);
    }
    return base(path, init);
  });
}

export const SeriesPickSyncsAuthorsAndSubsetRestores: Story = {
  beforeEach: mockWitcherSeries,
  play: async ({ canvas }) => {
    const surface = within(document.body);

    await userEvent.type(canvas.getByLabelText("Назва"), "Меч призначення");

    const authorInput = canvas.getByLabelText("Автор");
    await userEvent.click(authorInput);
    await userEvent.click(await surface.findByText("Анджей Сапковський"));

    await userEvent.click(canvas.getByRole("radio", { name: "Частина серії" }));

    const seriesInput = canvas.getByLabelText("Серія");
    await userEvent.click(seriesInput);
    await userEvent.click(await surface.findByText("Відьмак"));
    await waitFor(() => expect(canvas.getByLabelText("Серія")).toHaveValue("Відьмак"));

    await userEvent.click(
      canvas.getByRole("button", { name: "Видалити автора «Анджей Сапковський»" }),
    );

    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Видалити автора «Анджей Сапковський»" }),
      ).toBeVisible(),
    );
    await expect(canvas.getByLabelText("Серія")).toHaveValue("Відьмак");
    await expect(canvas.queryByText(/повторно обрати серію/)).toBeNull();
  },
};

export const ForeignAuthorClearsSeries: Story = {
  beforeEach: mockWitcherSeries,
  play: async ({ canvas }) => {
    const surface = within(document.body);

    await userEvent.type(canvas.getByLabelText("Назва"), "Меч призначення");

    const authorInput = canvas.getByLabelText("Автор");
    await userEvent.click(authorInput);
    await userEvent.click(await surface.findByText("Анджей Сапковський"));

    await userEvent.click(canvas.getByRole("radio", { name: "Частина серії" }));

    const seriesInput = canvas.getByLabelText("Серія");
    await userEvent.click(seriesInput);
    await userEvent.click(await surface.findByText("Відьмак"));
    await waitFor(() => expect(canvas.getByLabelText("Серія")).toHaveValue("Відьмак"));

    await userEvent.click(authorInput);
    await userEvent.type(authorInput, "Стівен Кінг");
    await userEvent.click(await surface.findByText(/^Створити «/));

    await expect(await canvas.findByText(/повторно обрати серію/)).toBeVisible();
    await waitFor(() => expect(canvas.getByLabelText("Серія")).toHaveValue(""));
  },
};

export const EnterInTitleDoesNotSubmit: Story = {
  play: async ({ canvas }) => {
    let createPayload: unknown = null;
    mockFetch(
      taxonomyHandler((path, init) => {
        if (path.includes("/api/books") && init?.method === "POST") {
          createPayload = JSON.parse(String(init.body));
          return jsonResponse(201, {});
        }
        return emptyAuthorSearch;
      }),
    );
    const surface = within(document.body);

    await userEvent.type(canvas.getByLabelText("Назва"), "Енеїда");
    const authorInput = canvas.getByLabelText("Автор");
    await userEvent.click(authorInput);
    await userEvent.type(authorInput, "Іван Котляревський");
    await userEvent.click(await surface.findByText(/^Створити «/));

    const titleInput = canvas.getByLabelText("Назва");
    await userEvent.click(titleInput);
    await userEvent.keyboard("{Enter}");

    await expect(createPayload).toBeNull();

    await userEvent.click(canvas.getByRole("button", { name: /Додати книгу/ }));
    await waitFor(() => expect(createPayload).not.toBeNull());
  },
};
