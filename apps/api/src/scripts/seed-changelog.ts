import type { ChangelogCategory, Nullable } from "@app/shared";

import { parseISO } from "date-fns";

import { createLogger } from "../core/logger.js";
import { PrismaClient } from "../generated/prisma/client.js";
import { createSeedClient } from "./seed-client.js";

const logger = createLogger("seed.changelog");

type ChangelogSeedEntry = {
  bodyEn: string;
  bodyUk: string;
  category: ChangelogCategory;
  publishedAt: string;
  slug: string;
  titleEn: string;
  titleUk: string;
  version: Nullable<string>;
};

const CHANGELOG_ENTRIES: ChangelogSeedEntry[] = [
  {
    bodyEn: "Pick book genres from a shared catalog and add your own custom ones.",
    bodyUk: "Обирайте жанри книг зі спільного каталогу та додавайте власні.",
    category: "feature",
    publishedAt: "2026-07-10T12:40:25.000Z",
    slug: "genres",
    titleEn: "Genres",
    titleUk: "Жанри",
    version: null,
  },
  {
    bodyEn: "Upload and crop book covers to bring your library to life.",
    bodyUk: "Завантажуйте та обрізайте обкладинки книг, щоб бібліотека виглядала жваво.",
    category: "feature",
    publishedAt: "2026-07-10T12:40:30.000Z",
    slug: "book-covers",
    titleEn: "Book covers",
    titleUk: "Обкладинки книг",
    version: null,
  },
  {
    bodyEn:
      "Rating stars now snap cleanly to half or full, and a duplicate series-part link opens the book's edit page.",
    bodyUk:
      "Зірки рейтингу тепер чітко фіксуються на половині або цілій зірці, а посилання на дубль частини серії відкриває сторінку редагування книги.",
    category: "fix",
    publishedAt: "2026-07-10T12:40:05.000Z",
    slug: "reading-polish",
    titleEn: "Rating and link fixes",
    titleUk: "Виправлення рейтингу та посилань",
    version: null,
  },
  {
    bodyEn:
      "Add books to your personal library, track reading statuses, and open a detailed page for each book.",
    bodyUk:
      "Додавайте книги до особистої бібліотеки, ведіть статуси читання та відкривайте детальну сторінку кожної книги.",
    category: "feature",
    publishedAt: "2026-06-30T00:00:00.000Z",
    slug: "book-library",
    titleEn: "My library and book page",
    titleUk: "Моя бібліотека та картка книги",
    version: null,
  },
  {
    bodyEn:
      "Every book now has a full page with reading progress, rating, cover, and one-click quick actions.",
    bodyUk:
      "Кожна книга тепер має повноцінну сторінку: прогрес читання, рейтинг, обкладинка та швидкі дії в один клік.",
    category: "feature",
    publishedAt: "2026-07-10T12:41:00.000Z",
    slug: "book-details",
    titleEn: "Detailed book page",
    titleUk: "Детальна сторінка книги",
    version: null,
  },
  {
    bodyEn: "Group books into series and track which part is next to read.",
    bodyUk: "Об'єднуйте книги в серії та стежте, яка частина наступна до прочитання.",
    category: "feature",
    publishedAt: "2026-07-03T00:00:00.000Z",
    slug: "series",
    titleEn: "Book series",
    titleUk: "Серії книг",
    version: null,
  },
  {
    bodyEn: "The reading-impression text limit is now 5000 characters.",
    bodyUk: "Ліміт тексту вражень від читання збільшено до 5000 символів.",
    category: "improvement",
    publishedAt: "2026-07-10T12:40:15.000Z",
    slug: "longer-impressions",
    titleEn: "Longer reading impressions",
    titleUk: "Довші враження від читання",
    version: null,
  },
  {
    bodyEn:
      "Plan your reading order: add books to a queue, reorder them, and start reading right from it.",
    bodyUk:
      "Плануйте порядок читання: додавайте книги в чергу, змінюйте послідовність і починайте читати прямо звідти.",
    category: "feature",
    publishedAt: "2026-07-10T12:40:50.000Z",
    slug: "reading-queue",
    titleEn: "Reading queue",
    titleUk: "Черга читання",
    version: null,
  },
  {
    bodyEn: "Mark books as favorites and collect them on a dedicated favorites page.",
    bodyUk: "Позначайте улюблені книги та збирайте їх на окремій сторінці обраного.",
    category: "feature",
    publishedAt: "2026-07-10T12:40:45.000Z",
    slug: "favorites",
    titleEn: "Favorites",
    titleUk: "Обране",
    version: null,
  },
  {
    bodyEn: "Keep track of books you lent out or borrowed, with a full loan history.",
    bodyUk: "Ведіть облік книг, які ви позичили комусь або взяли почитати, з історією позик.",
    category: "feature",
    publishedAt: "2026-07-10T12:40:40.000Z",
    slug: "loans",
    titleEn: "Book loans",
    titleUk: "Позики книг",
    version: null,
  },
  {
    bodyEn: "Create your own book lists, add books to them, and arrange them however you like.",
    bodyUk: "Створюйте власні списки книг, додавайте до них книги та впорядковуйте на свій смак.",
    category: "feature",
    publishedAt: "2026-07-10T12:40:55.000Z",
    slug: "custom-lists",
    titleEn: "Custom lists",
    titleUk: "Власні списки",
    version: null,
  },
  {
    bodyEn: "Follow app updates in the What's New feed, with an unread indicator.",
    bodyUk: "Слідкуйте за оновленнями застосунку у стрічці «Що нового» з позначкою непрочитаних.",
    category: "feature",
    publishedAt: "2026-07-10T12:40:20.000Z",
    slug: "whats-new",
    titleEn: "What's New feed",
    titleUk: "Стрічка «Що нового»",
    version: null,
  },
  {
    bodyEn: "Track ordered books in transit, and review your delivery history and statistics.",
    bodyUk: "Відстежуйте замовлені книги в дорозі та переглядайте історію доставок і статистику.",
    category: "feature",
    publishedAt: "2026-07-10T12:40:35.000Z",
    slug: "delivery",
    titleEn: "Book deliveries",
    titleUk: "Доставки книг",
    version: null,
  },
  {
    bodyEn: "The series sequence on the book page now shows book covers.",
    bodyUk: "У розділі послідовності серії на сторінці книги тепер показуються обкладинки книг.",
    category: "improvement",
    publishedAt: "2026-07-10T12:40:10.000Z",
    slug: "series-book-covers",
    titleEn: "Covers in the series sequence",
    titleUk: "Обкладинки в послідовності серії",
    version: null,
  },
  {
    bodyEn:
      "Your library now shows books as poster-style cards — cover art with reading-status and ownership badges, quick actions, and genre chips.",
    bodyUk:
      "Бібліотека тепер показує книги як картки-постери: обкладинка з позначками статусу читання й власності, швидкі дії та чипи жанрів.",
    category: "improvement",
    publishedAt: "2026-07-11T06:00:00.000Z",
    slug: "library-cards-redesign",
    titleEn: "Refreshed library cards",
    titleUk: "Оновлені картки бібліотеки",
    version: null,
  },
  {
    bodyEn:
      "Filter your library with a rating range slider and multi-select pickers for authors, publishers, tags, and genres, then apply them together. Summary cards now surface extra stats like series and author counts and your current reading progress.",
    bodyUk:
      "Фільтруйте бібліотеку повзунком діапазону рейтингу та мультивибором авторів, видавців, тегів і жанрів, а потім застосовуйте їх разом. Картки підсумків тепер показують додаткову статистику: кількість серій та авторів і ваш поточний прогрес читання.",
    category: "improvement",
    publishedAt: "2026-07-12T06:00:00.000Z",
    slug: "library-filters-summary",
    titleEn: "Improved library filters and stats",
    titleUk: "Покращені фільтри та статистика бібліотеки",
    version: null,
  },
  {
    bodyEn:
      "Refreshed the empty-state illustrations across the app and added a localized page-not-found screen for unknown links.",
    bodyUk:
      "Оновили ілюстрації порожніх станів у застосунку та додали локалізовану сторінку, коли за посиланням нічого не знайдено.",
    category: "improvement",
    publishedAt: "2026-07-13T12:00:00.000Z",
    slug: "empty-states-refresh",
    titleEn: "Refreshed empty states and 404 page",
    titleUk: "Оновлені порожні стани та сторінка 404",
    version: null,
  },
  {
    bodyEn:
      "The book page now shows a reading-activity chart with key stats and a pace forecast, plus a full day-by-day history of your progress updates.",
    bodyUk:
      "Сторінка книги тепер показує графік активності читання з ключовою статистикою та прогнозом темпу, а також повну історію оновлень прогресу за днями.",
    category: "feature",
    publishedAt: "2026-07-16T00:00:00.000Z",
    slug: "reading-progress-history",
    titleEn: "Reading statistics and history",
    titleUk: "Статистика та історія читання",
    version: null,
  },
  {
    bodyEn:
      "Keep notes on your books and series — organize them by category, pin the important ones, mark favorites, and hide spoilers.",
    bodyUk:
      "Ведіть нотатки до книг і серій — впорядковуйте їх за категоріями, закріплюйте важливі, позначайте улюблені та ховайте спойлери.",
    category: "feature",
    publishedAt: "2026-07-18T06:00:00.000Z",
    slug: "notes",
    titleEn: "Notes",
    titleUk: "Нотатки",
    version: null,
  },
  {
    bodyEn:
      "Save favorite quotes from your books with page references, mark the ones you love, and hide spoilers.",
    bodyUk:
      "Зберігайте улюблені цитати з книг із зазначенням сторінок, позначайте найкращі та ховайте спойлери.",
    category: "feature",
    publishedAt: "2026-07-18T06:00:01.000Z",
    slug: "quotes",
    titleEn: "Quotes",
    titleUk: "Цитати",
    version: null,
  },
  {
    bodyEn:
      "Browse, search, and sort the dedications from your books, and mark the ones that stay with you.",
    bodyUk:
      "Переглядайте, шукайте та сортуйте присвяти з ваших книг і позначайте ті, що западають у душу.",
    category: "feature",
    publishedAt: "2026-07-18T06:00:02.000Z",
    slug: "dedications",
    titleEn: "Book dedications",
    titleUk: "Присвяти книг",
    version: null,
  },
  {
    bodyEn:
      "Build a wishlist of books to buy, add store links with prices, and see the best current offer at a glance.",
    bodyUk:
      "Складайте список книг до купівлі, додавайте посилання на магазини з цінами та одразу бачте найкращу пропозицію.",
    category: "feature",
    publishedAt: "2026-07-18T06:00:03.000Z",
    slug: "books-to-buy",
    titleEn: "Books to buy",
    titleUk: "Книги до купівлі",
    version: null,
  },
  {
    bodyEn:
      "Organize books with your own tags — create and edit them, give them colors, and see how often you use each one.",
    bodyUk:
      "Впорядковуйте книги власними тегами — створюйте й редагуйте їх, задавайте кольори та дивіться, як часто ви користуєтеся кожним.",
    category: "feature",
    publishedAt: "2026-07-18T06:00:04.000Z",
    slug: "tags",
    titleEn: "Tags",
    titleUk: "Теги",
    version: null,
  },
  {
    bodyEn:
      "A new home page greets you after signing in — library summary cards, a deliveries widget, and an overview of your reading progress.",
    bodyUk:
      "Нова головна сторінка вітає вас після входу — картки підсумків бібліотеки, віджет доставок та огляд вашого прогресу читання.",
    category: "feature",
    publishedAt: "2026-07-18T06:00:05.000Z",
    slug: "home-dashboard",
    titleEn: "Home dashboard",
    titleUk: "Головна панель",
    version: null,
  },
  {
    bodyEn:
      "Spot when series books sit out of order in your reading queue and fix the sequence with a one-click preview.",
    bodyUk:
      "Помічайте, коли книги серії стоять у черзі читання не за порядком, і виправляйте послідовність одним кліком із попереднім переглядом.",
    category: "feature",
    publishedAt: "2026-07-18T06:00:06.000Z",
    slug: "series-order-check",
    titleEn: "Series order check",
    titleUk: "Перевірка порядку серій",
    version: null,
  },
  {
    bodyEn:
      "When adding a book to the reading queue you can now set a priority reason and a target date, shown back on the book and in the queue.",
    bodyUk:
      "Додаючи книгу в чергу читання, тепер можна вказати причину пріоритету та цільову дату — вони показуються на книзі та в черзі.",
    category: "improvement",
    publishedAt: "2026-07-18T06:00:07.000Z",
    slug: "reading-queue-priority",
    titleEn: "Reading-queue priority",
    titleUk: "Пріоритет у черзі читання",
    version: null,
  },
  {
    bodyEn: "Assign several authors to a single book.",
    bodyUk: "Призначайте кілька авторів одній книзі.",
    category: "improvement",
    publishedAt: "2026-07-18T06:00:08.000Z",
    slug: "multiple-authors",
    titleEn: "Multiple authors",
    titleUk: "Кілька авторів",
    version: null,
  },
  {
    bodyEn: "Series now carry their own genres, just like books do.",
    bodyUk: "Серії тепер мають власні жанри, як і книги.",
    category: "improvement",
    publishedAt: "2026-07-18T06:00:09.000Z",
    slug: "series-genres",
    titleEn: "Series genres",
    titleUk: "Жанри серій",
    version: null,
  },
  {
    bodyEn: "Books marked 18+ now show an adult-content badge on cards and rows.",
    bodyUk:
      "Книги з позначкою 18+ тепер показують значок дорослого контенту на картках і в рядках.",
    category: "improvement",
    publishedAt: "2026-07-18T06:00:10.000Z",
    slug: "adult-age-badge",
    titleEn: "18+ age badge",
    titleUk: "Значок 18+",
    version: null,
  },
  {
    bodyEn:
      "Browse the publishers in your library with their ratings and purchases, open a page for each one, and manage your own custom publishers.",
    bodyUk:
      "Переглядайте видавництва своєї бібліотеки з їхніми рейтингами й покупками, відкривайте сторінку кожного та керуйте власними видавництвами.",
    category: "feature",
    publishedAt: "2026-07-24T00:00:00.000Z",
    slug: "publishers",
    titleEn: "Publishers",
    titleUk: "Видавництва",
    version: null,
  },
  {
    bodyEn:
      "Keep a cast of characters for each book — add them with roles, mark favorites, and hide spoilers.",
    bodyUk:
      "Ведіть список персонажів для кожної книги — додавайте їх із ролями, позначайте улюблених і ховайте спойлери.",
    category: "feature",
    publishedAt: "2026-07-24T00:00:01.000Z",
    slug: "characters",
    titleEn: "Characters",
    titleUk: "Персонажі",
    version: null,
  },
  {
    bodyEn:
      "Build a timeline of a book's key events to remember what happened, with support for several parallel timelines.",
    bodyUk:
      "Створюйте хронологію ключових подій книги, щоб пам'ятати, що сталося, з підтримкою кількох паралельних ліній.",
    category: "feature",
    publishedAt: "2026-07-24T00:00:02.000Z",
    slug: "book-timeline",
    titleEn: "Event timeline",
    titleUk: "Хронологія подій",
    version: null,
  },
  {
    bodyEn:
      "Your reading queue now shows summary cards and its total page volume, and you can filter it by status, format, genre, rating, and more.",
    bodyUk:
      "Черга читання тепер показує картки підсумків і загальний обсяг сторінок, а фільтрувати її можна за статусом, форматом, жанром, рейтингом та іншим.",
    category: "improvement",
    publishedAt: "2026-07-24T00:00:03.000Z",
    slug: "reading-queue-insights",
    titleEn: "Reading-queue insights and filters",
    titleUk: "Огляд і фільтри черги читання",
    version: null,
  },
  {
    bodyEn:
      "The series page now highlights read pages, your reading window, and favorite book in the series, plus genres, years, and publishers.",
    bodyUk:
      "Сторінка серії тепер показує прочитані сторінки, період читання й улюблену книгу серії, а також жанри, роки та видавництва.",
    category: "improvement",
    publishedAt: "2026-07-24T00:00:04.000Z",
    slug: "series-details-stats",
    titleEn: "Richer series details",
    titleUk: "Докладніша сторінка серії",
    version: null,
  },
  {
    bodyEn:
      "Get reminders about book returns and deliveries in the notification bell and by email. The bell now has two tabs: Reminders and What's New.",
    bodyUk:
      "Отримуйте нагадування про повернення книг і про доставки у дзвіночку сповіщень і на пошту. Дзвіночок тепер має дві вкладки: «Нагадування» і «Що нового».",
    category: "feature",
    publishedAt: "2026-07-31T00:00:00.000Z",
    slug: "reminders",
    titleEn: "Reminders",
    titleUk: "Нагадування",
    version: null,
  },
  {
    bodyEn:
      "A settings page is now available: turn loan and delivery emails on or off, choose how many days ahead to be reminded about a return, and set your time zone. You can also send yourself a test notification from there.",
    bodyUk:
      "З'явилася сторінка налаштувань: вмикайте листи про позики та доставки, задавайте, за скільки днів нагадувати про повернення, і обирайте свій часовий пояс. Звідти ж можна надіслати собі тестове сповіщення.",
    category: "feature",
    publishedAt: "2026-07-31T00:00:01.000Z",
    slug: "settings",
    titleEn: "Settings",
    titleUk: "Налаштування",
    version: null,
  },
  {
    bodyEn:
      "An uploaded cover now appears in your library by itself as soon as it is ready, without reloading the page.",
    bodyUk:
      "Завантажена обкладинка тепер з'являється в бібліотеці сама, щойно буде готова, без перезавантаження сторінки.",
    category: "improvement",
    publishedAt: "2026-07-31T00:00:02.000Z",
    slug: "live-cover-updates",
    titleEn: "Covers without a reload",
    titleUk: "Обкладинки без перезавантаження",
    version: null,
  },
  {
    bodyEn:
      "The series list is rebuilt: switch between grid and list views, narrow things down with advanced filters and see the matching count with active-filter chips, and let the sidebar point out the series that need attention. Cards now carry a cover fan, clearer progress, and a badge showing whether you already own the next book.",
    bodyUk:
      "Список серій оновлено: перемикайтеся між сіткою та списком, звужуйте добірку розширеними фільтрами й бачте кількість результатів із чипами активних фільтрів, а бічна панель підкаже серії, які потребують уваги. На картках тепер віяло обкладинок, зрозуміліший прогрес і позначка, чи наступна книга вже у вас.",
    category: "improvement",
    publishedAt: "2026-08-05T00:00:00.000Z",
    slug: "series-list-overhaul",
    titleEn: "A rebuilt series list",
    titleUk: "Оновлений список серій",
    version: null,
  },
  {
    bodyEn:
      "The dedications page got a rework: summary cards at the top, a compact list view next to the cards, and a new flow to add a dedication by picking the book it belongs to.",
    bodyUk:
      "Сторінку присвят перероблено: картки підсумків угорі, компактний вигляд списком поруч із картками та новий спосіб додати присвяту, обравши книгу, якій вона належить.",
    category: "improvement",
    publishedAt: "2026-08-05T00:00:01.000Z",
    slug: "dedications-revamp",
    titleEn: "Dedications, reworked",
    titleUk: "Присвяти, оновлено",
    version: null,
  },
  {
    bodyEn:
      "Your lists now open with summary cards: how many lists you keep, how many distinct books they hold, the average and largest list, and how many books sit in more than one list. The sidebar points out the lists that need attention, and sort labels now read the same way across lists and series.",
    bodyUk:
      "Списки тепер відкриваються картками підсумків: скільки у вас списків, скільки різних книг вони містять, середній і найбільший список, а також скільки книг потрапило одразу в кілька списків. Бічна панель підкаже списки, які потребують уваги, а підписи сортування тепер однакові для списків і серій.",
    category: "improvement",
    publishedAt: "2026-08-05T00:00:02.000Z",
    slug: "lists-summary-overview",
    titleEn: "Lists at a glance",
    titleUk: "Списки з першого погляду",
    version: null,
  },
  {
    bodyEn:
      "The whole app is rebuilt for small screens. Book cards sit two per row in the grid and turn into compact rows in list view, the toolbar folds into a single row with icon-only filters and a bottom-sheet sort picker, and the desktop sidebars step aside. The same pattern now covers the library, favorites, series, dedications, the reading queue, lists, loans, deliveries, quotes, notes, books to buy, publishers, genres and tags, and the home page.",
    bodyUk:
      "Увесь застосунок перебудовано під малі екрани. Картки книг стоять по дві в ряд у сітці й перетворюються на компактні рядки у вигляді списку, панель інструментів згортається в один рядок із фільтрами-іконками та вибором сортування знизу, а бічні панелі відступають. Той самий підхід тепер охоплює бібліотеку, обране, серії, присвяти, чергу читання, списки, позики, доставки, цитати, нотатки, книги до купівлі, видавництва, жанри й теги та головну сторінку.",
    category: "improvement",
    publishedAt: "2026-08-07T00:00:00.000Z",
    slug: "mobile-redesign",
    titleEn: "Book Nest on a phone",
    titleUk: "Book Nest на телефоні",
    version: null,
  },
  {
    bodyEn:
      "Statistics and the side blocks no longer trail the end of the page on a phone. Every list page now has an overview button that opens a full-screen panel with tabs: detailed stats, top genres and tags, recently added, and whatever else that page keeps in its sidebar. It closes with the button, Escape, a tap outside, or the system Back button.",
    bodyUk:
      "Статистика та бічні блоки більше не тягнуться в кінці сторінки на телефоні. Кожна сторінка зі списком тепер має кнопку огляду, яка відкриває повноекранну панель із вкладками: детальна статистика, топ жанрів і тегів, нещодавно додані та все інше, що сторінка тримає в бічній панелі. Панель закривається кнопкою, клавішею Escape, дотиком поза нею або системною кнопкою «Назад».",
    category: "feature",
    publishedAt: "2026-08-07T00:00:01.000Z",
    slug: "mobile-overview-panel",
    titleEn: "Page overview on mobile",
    titleUk: "Огляд сторінки на телефоні",
    version: null,
  },
  {
    bodyEn:
      "The book page reflows on small screens: statuses and the favorite and menu buttons move to their own row above the title, the title takes the full width, the cover shrinks, and the dedication and genres run underneath. Tags show four at a time with a chip that reveals the rest, and quick info and statuses sit under the header instead of in a sidebar.",
    bodyUk:
      "Сторінка книги перебудовується на малих екранах: статуси та кнопки обраного й меню переходять в окремий рядок над назвою, назва займає всю ширину, обкладинка зменшується, а присвята та жанри йдуть нижче. Теги показують по чотири з чипом, який розкриває решту, а швидка інформація та статуси стають під шапкою замість бічної панелі.",
    category: "improvement",
    publishedAt: "2026-08-07T00:00:02.000Z",
    slug: "book-page-mobile",
    titleEn: "The book page on a phone",
    titleUk: "Сторінка книги на телефоні",
    version: null,
  },
  {
    bodyEn:
      "Your lists page now works like the library: search, sort, a filter sheet for fill, description, size and attention, and every applied filter shown as a chip you can remove. Switch between grid and list view, and load more lists as you go instead of waiting for all of them. Filtering and counting now happen on the server, so the attention numbers cover your whole library rather than the part already loaded, and a book in the trash no longer keeps a list in the wrong size bucket.",
    bodyUk:
      "Сторінка списків тепер працює як бібліотека: пошук, сортування, панель фільтрів за наповненням, описом, розміром і увагою, а кожен застосований фільтр показано чипом, який можна зняти. Перемикайтеся між сіткою та списком і довантажуйте наступні списки замість очікування всіх одразу. Фільтрація та підрахунок тепер відбуваються на сервері, тож числа про увагу охоплюють усю бібліотеку, а не лише завантажену частину, а книга в кошику більше не тримає список у неправильному діапазоні розміру.",
    category: "improvement",
    publishedAt: "2026-08-07T00:00:03.000Z",
    slug: "lists-filters-view-mode",
    titleEn: "Filters and a list view for your lists",
    titleUk: "Фільтри та вигляд списком для ваших списків",
    version: null,
  },
  {
    bodyEn:
      'The buy list is now called the wishlist everywhere, and the ownership status reads "On the wishlist" so the label names the page it feeds. More importantly, the shop and price you enter when adding a book are finally saved where the wishlist reads them — until now they were written somewhere the page never looked, so the offer you typed simply never appeared. Shop and link now go together, and re-entering an offer for the same shop updates the price instead of failing.',
    bodyUk:
      "Список покупок тепер усюди називається списком бажань, а статус володіння читається як «У списку бажань», тож підпис називає сторінку, на яку веде. Головне ж інше: магазин і ціна, які ви вводите, додаючи книгу, нарешті зберігаються там, звідки їх читає список бажань — досі вони потрапляли туди, куди сторінка не дивиться, і введена пропозиція просто не з'являлася. Магазин і посилання тепер вводяться разом, а повторна пропозиція для того самого магазину оновлює ціну замість помилки.",
    category: "improvement",
    publishedAt: "2026-08-07T00:00:04.000Z",
    slug: "wishlist-store-links",
    titleEn: "The wishlist keeps where to buy",
    titleUk: "Список бажань запам'ятовує, де купити",
    version: null,
  },
  {
    bodyEn:
      "The wishlist now remembers the day a book landed on it, and four cards above the list turn that into a picture: how many books you want, how many arrived in the last month, how many fill a gap in a series you already own part of, how many continue one past your last part, and how many have been waiting longer than six months. Sorting by date follows the same rule, so a book you have owned for a year but only wanted since yesterday no longer pretends to be the oldest wish on the list.",
    bodyUk:
      "Список бажань тепер памʼятає день, коли книга до нього потрапила, а чотири картки над списком складають із цього картину: скільки книг ви хочете, скільки додано за останній місяць, скільки закривають пропуск у серії, частину якої ви вже маєте, скільки продовжують серію далі за вашу останню частину і скільки чекають довше за шість місяців. Сортування за датою тепер працює за тим самим правилом, тож книга, яка рік стоїть у бібліотеці, а в списку бажань лише з учора, більше не вдає найдавніше бажання.",
    category: "improvement",
    publishedAt: "2026-08-10T00:00:00.000Z",
    slug: "wishlist-entry-date-counts",
    titleEn: "The wishlist counts what you are waiting for",
    titleUk: "Список бажань рахує, чого ви чекаєте",
    version: null,
  },
  {
    bodyEn:
      "You can now set a goal to read a set number of books from one of your lists by a date you choose. The list itself shows a card with how far along you are, the goal page lists the books that count toward it, and progress follows what you actually read instead of waiting to be updated by hand. A goal can be edited, archived or deleted at any time, and since a list holds one open goal, archiving the current one frees the slot for the next.",
    bodyUk:
      "Тепер ви можете поставити ціль: прочитати певну кількість книг з одного зі своїх списків до обраної дати. На самому списку з'являється картка з тим, наскільки ви просунулися, а на сторінці цілі видно книги, які до неї зараховуються, і поступ рахується з того, що ви читаєте, а не з ручних позначок. Ціль можна змінити, заархівувати або видалити будь-коли, а оскільки список тримає одну відкриту ціль, архівування звільняє місце для наступної.",
    category: "feature",
    publishedAt: "2026-08-10T00:00:00.000Z",
    slug: "reading-goals",
    titleEn: "Reading goals",
    titleUk: "Цілі з читання",
    version: null,
  },
  {
    bodyEn:
      "The page of a single list now carries a sidebar with what the list is about, what you are currently reading from it, related lists and summary numbers. Quick tabs and advanced filters tell you how many books sit behind each value before you pick it, books can be dragged into the order you want, several books can be selected at once and handled together or removed in one go, a whole list can be duplicated, and every book row has a menu with the next sensible step for it.",
    bodyUk:
      "Сторінка окремого списку тепер має бічну панель: про що цей список, що ви зараз із нього читаєте, споріднені списки та підсумкові цифри. Швидкі вкладки й розширені фільтри показують, скільки книг стоїть за кожним значенням ще до вибору, книги можна перетягувати в потрібному порядку, обирати кілька одразу й виконувати дію для всіх обраних, зокрема прибирати їх зі списку, дублювати весь список, а меню біля кожної книги пропонує наступну доречну дію.",
    category: "improvement",
    publishedAt: "2026-08-10T00:00:01.000Z",
    slug: "list-details-overhaul",
    titleEn: "The list page, rebuilt",
    titleUk: "Оновлена сторінка списку",
    version: null,
  },
  {
    bodyEn:
      "The wishlist and the reading queue used to load every book and narrow it down in the browser, so a filter only covered what had already loaded and a safety cap could trim the result before sorting. Both now search, filter and sort on the server across your whole collection. The store and author options describe the full list instead of the part left after filtering, and the wishlist on a phone now has the same shape as the library.",
    bodyUk:
      "Список бажань і черга читання раніше завантажували всі книги й відсіювали їх уже в браузері, тож фільтр працював лише по тому, що встигло завантажитися, а обмеження на кількість могло обрізати результат ще до сортування. Тепер пошук, фільтри та сортування виконуються на сервері по всій колекції. Варіанти магазинів і авторів описують увесь список, а не його відфільтровану частину, а список бажань на телефоні має той самий вигляд, що й бібліотека.",
    category: "improvement",
    publishedAt: "2026-08-11T00:00:00.000Z",
    slug: "whole-collection-filtering",
    titleEn: "Filtering across the whole collection",
    titleUk: "Фільтри по всій колекції",
    version: null,
  },
  {
    bodyEn:
      "Alphabetical lists now sort by Ukrainian rules, so І sits between З and Й, Є comes after Е, and Ґ right after Г. Before this, І and Є jumped to the top of the list ahead of А and Ґ fell to the very bottom after Я, which you could see in the library, the wishlist, series, publishers, lists, characters, tags, genres, loans and deliveries, including when sorting by author.",
    bodyUk:
      "Списки за абеткою тепер упорядковуються за українськими правилами: І стоїть між З і Й, Є після Е, а Ґ одразу після Г. Раніше І та Є опинялися на початку перед А, а Ґ у самому кінці після Я, і це було помітно в бібліотеці, списку бажань, серіях, видавництвах, списках, персонажах, тегах, жанрах, позиках і доставках, зокрема під час сортування за автором.",
    category: "fix",
    publishedAt: "2026-08-12T00:00:00.000Z",
    slug: "ukrainian-alphabet-sorting",
    titleEn: "Ukrainian alphabetical sorting",
    titleUk: "Сортування за українською абеткою",
    version: null,
  },
  {
    bodyEn:
      "Author and genre filters in the library, favorites, the reading queue, the wishlist and on the series page now offer only the values those pages actually hold, with the number of books behind each one. If the author you want is not on the list, start typing the name and the search continues on the server over the same set of books. The series list is now filtered and sorted on the server, so the selection and the order cover your whole collection instead of the part already loaded, and search matches author names too. The filters you pick stay in the page address, so a filtered view can be shared and survives a reload.",
    bodyUk:
      "Фільтри за автором і жанром у бібліотеці, обраному, черзі читання, списку бажань і на сторінці серій тепер пропонують лише те, що на цій сторінці справді є, і поруч із кожним значенням стоїть кількість книг за ним. Якщо потрібного автора не видно в переліку, почніть вводити ім'я: пошук піде на сервер у межах тих самих книг. Список серій тепер фільтрується та сортується на сервері, тож добірка й порядок охоплюють усю колекцію, а не лише завантажену частину, а пошук знаходить серії ще й за іменем автора. Обрані фільтри лишаються в адресі сторінки, тож посиланням можна поділитися, і воно переживе перезавантаження.",
    category: "improvement",
    publishedAt: "2026-08-12T00:00:01.000Z",
    slug: "facet-filters-everywhere",
    titleEn: "Filters with book counts",
    titleUk: "Фільтри з кількістю книг",
    version: null,
  },
  {
    bodyEn:
      "A list page now has quick filters for favorites, the reading queue and books that belong to a series. The book card and the page header were rebuilt, and the whole page lays out properly on a phone. Adding a book to a list or taking it out now refreshes the lists it appears in right away instead of leaving the old membership on screen.",
    bodyUk:
      "На сторінці окремого списку з'явилися швидкі фільтри для обраного, черги читання та книг, що входять до серії. Картку книги й шапку сторінки перебудовано, а вся сторінка тепер нормально розкладається на телефоні. Коли ви додаєте книгу до списку або прибираєте її звідти, списки, у яких вона є, оновлюються одразу, а не показують попередній стан.",
    category: "improvement",
    publishedAt: "2026-08-12T00:00:02.000Z",
    slug: "list-page-quick-filters",
    titleEn: "Quick filters on a list page",
    titleUk: "Швидкі фільтри на сторінці списку",
    version: null,
  },
  {
    bodyEn:
      "The About block on a list page counted books that belong to a series instead of the series themselves, so a list of nine books from three series showed nine series. The count is now right, and the three most common genres are ordered by name when several of them hold the same number of books.",
    bodyUk:
      "У блоці «Про список» кількість серій рахувала книги, що входять до серій, а не самі серії, тож список із дев'яти книг із трьох серій показував дев'ять серій. Тепер число правильне, а три найчастіші жанри при однаковій кількості книг стоять за назвою.",
    category: "fix",
    publishedAt: "2026-08-12T00:00:03.000Z",
    slug: "list-overview-counts",
    titleEn: "List overview counts",
    titleUk: "Підрахунки в блоці «Про список»",
    version: null,
  },
  {
    bodyEn:
      "The two pages for active loans, the books you lent out and the books you have to return, are now built the same way. Each of them has its own stat cards on top: how many books are with people and with how many of them, how many are due back within the coming week, how many are overdue and how many went out with no return date at all. A sidebar shows what needs attention and who is holding the most of your books, and clicking a row narrows the list to exactly those loans. Quick filter chips with counts sit above the list, sorting now names the direction it goes in, and a show more button replaced the pager. Every loan carries its own menu: change the return date, push it by 7 or 14 days, set a reminder a chosen number of days before the book is due, correct the loan or mark the book as returned.",
    bodyUk:
      "Сторінки «Треба повернути» та «Передано іншим» перебудовано за однією схемою. Угорі кожної з них тепер свої картки статистики: скільки книг у людей і в скількох саме, скільки треба повернути найближчого тижня, скільки прострочено і скільки віддано взагалі без дати повернення. Збоку стоїть блок про те, що потребує уваги, і про те, у кого зараз найбільше ваших книг, а клік по рядку одразу звужує список до цих позик. Над списком з'явилися швидкі фільтри з кількостями, сортування називає ще й напрямок, а замість посторінкового переходу працює кнопка «Показати ще». Кожна позика має власне меню: змінити дату повернення, відсунути її на 7 або 14 днів, налаштувати нагадування за обрану кількість днів до строку, виправити позику чи позначити книгу поверненою.",
    category: "improvement",
    publishedAt: "2026-08-13T00:00:00.000Z",
    slug: "loans-overview-rework",
    titleEn: "Reworked active loan pages",
    titleUk: "Оновлені сторінки активних позик",
    version: null,
  },
  {
    bodyEn:
      "A reading goal now remembers which books its list held on the day you created it and counts only those. A book added to the list later does not join a goal that is already running, and a book taken out of the list still counts toward it. A book counts if you finished it between the day the goal started and its deadline, or the day it was archived if that came first.",
    bodyUk:
      "Ціль читання тепер запам'ятовує книги, які були в її списку в день створення, і рахує тільки їх. Книга, додана до списку пізніше, не приєднується до вже початої цілі, а прибрана зі списку далі рахується. Книга зараховується, якщо ви дочитали її між днем створення цілі та її дедлайном або днем архівації, якщо він настав раніше.",
    category: "improvement",
    publishedAt: "2026-08-13T00:00:01.000Z",
    slug: "reading-goal-snapshot",
    titleEn: "What a reading goal counts",
    titleUk: "Що рахує ціль читання",
    version: null,
  },
  {
    bodyEn:
      "A third page joins the two for active loans, this one for loans that are already finished. Summary cards sit on top, a sidebar collects the main facts about closed loans, and a period filter keeps the list to the stretch of time you care about. Every row tells the whole timeline: when the book changed hands, when it was due back, when it actually came back and how long that took. Clicking a row opens a panel with the full story of that loan, and if the dates were entered wrong back then, they can be corrected right there. Search, filters and sorting live in the page address, and the list grows with a show more button.",
    bodyUk:
      "Поруч із двома сторінками активних позик з'явилася третя, для тих, що вже завершені. Угорі картки з підсумками, збоку блок із головним про завершені позики, а фільтр за періодом лишає в списку тільки потрібний відрізок часу. Кожен рядок веде свою хронологію: коли книгу передали, коли обіцяли повернути, коли повернули насправді та скільки це тривало. Клік по рядку відкриває панель з усією історією позики, а якщо дати колись ввели неправильно, їх можна виправити просто звідти. Пошук, фільтри та сортування лишаються в адресі сторінки, а список доростає кнопкою «Показати ще».",
    category: "feature",
    publishedAt: "2026-08-14T00:00:00.000Z",
    slug: "loan-history",
    titleEn: "Loan history",
    titleUk: "Історія позик",
    version: null,
  },
  {
    bodyEn:
      "A delivery is no longer one book on its own. On the Books in transit page you now create a whole order at once: the store, the date, the currency, several books with their prices, the delivery cost and a discount, and you split the books between parcels. The order card runs everything after that: edit the amounts, the order date and the note, set the price of a single book, add a parcel or correct its tracking number, cancel a book or a whole parcel with the books it carries, and mark a parcel as received straight from its menu. The book picker offers only books that are not already on their way, and a long list of books folds up so the card stays readable.",
    bodyUk:
      "Доставка більше не рахується по одній книзі. На сторінці «Книги в дорозі» тепер створюється ціле замовлення одразу: магазин, дата, валюта, кілька книг із цінами, вартість доставки й знижка, а книги розкладаються по посилках. Далі всім керує картка замовлення: у ній можна змінити суми, дату замовлення та нотатку, вказати ціну окремої книги, додати посилку чи виправити її ТТН, скасувати книгу або цілу посилку разом із книгами, які вона везе, а отримати посилку тепер можна просто з її меню. У виборі книг пропонуються лише ті, що ще не їдуть у жодному замовленні, а довгий перелік книг згортається, щоб картка лишалася читабельною.",
    category: "feature",
    publishedAt: "2026-08-16T00:00:00.000Z",
    slug: "delivery-orders-and-parcels",
    titleEn: "Orders and parcels",
    titleUk: "Замовлення та посилки",
    version: null,
  },
  {
    bodyEn:
      "A shipment now moves to its next status in one click, straight from the order card. The status is spelled out next to the badge, the shipment menu can send it back a step, and a parcel waiting at a pickup point can carry the date it is held until.",
    bodyUk:
      "Посилка тепер переходить до наступного статусу одним кліком просто з картки замовлення. Статус підписаний поруч зі значком, у меню посилки його можна повернути на крок назад, а посилці на відділенні можна вказати дату, до якої її зберігають.",
    category: "feature",
    publishedAt: "2026-08-17T00:00:00.000Z",
    slug: "shipment-status-one-click",
    titleEn: "One-click shipment status",
    titleUk: "Статус посилки одним кліком",
    version: null,
  },
  {
    bodyEn:
      "The Books in transit page now has a side block that lists only the deliveries needing something from you: parcels whose pickup window has closed or is about to, parcels running late, orders the store has not shipped for over a week, dispatched parcels with no tracking number, parcels with no delivery date, and books not yet assigned to a parcel. Each row says how many, and clicking it shows exactly those deliveries in the list. When nothing needs you, the block says so.",
    bodyUk:
      "На сторінці «Книги в дорозі» збоку з’явився блок, який показує лише ті доставки, з якими треба щось зробити: посилки з простроченим або близьким кінцем зберігання, ті, що затримуються, замовлення, які магазин не відправив понад тиждень, відправлені посилки без ТТН, посилки без дати доставки та книги, не розподілені між посилками. Кожен рядок каже, скільки їх, а клік по ньому показує в списку саме ці доставки. Якщо все гаразд, блок так і каже.",
    category: "feature",
    publishedAt: "2026-08-18T00:00:00.000Z",
    slug: "delivery-attention-cases",
    titleEn: "Needs attention",
    titleUk: "Потребують уваги",
    version: null,
  },
  {
    bodyEn:
      "The top of the Books in transit page has been rebuilt. Eight quick filters became five that do not overlap: all, awaiting dispatch, in transit, ready for pickup and delayed, each with its own count. There are now four stat cards instead of five: books in transit, expected this week, active orders and order value, each with an extra line of detail. Order value is taken from the full order total with delivery and discount included, and expected this week now means from today until Sunday, counting only the parcels still on their way. A side block shows the delivery arriving next, with the date, the store, the service and what is inside, and a line under the toolbar tells you how many of the books are on screen right now.",
    bodyUk:
      "Верх сторінки «Книги в дорозі» перебудовано. Замість восьми швидких фільтрів лишилося п'ять, які не перетинаються між собою: усі, очікують відправлення, у дорозі, чекають на відділенні та затримуються, і кожен показує свою кількість. Карток статистики тепер чотири замість п'яти: книги в дорозі, очікуються цього тижня, активні замовлення та вартість замовлень, кожна з додатковим рядком подробиць. Вартість рахується по сумі всього замовлення разом із доставкою та знижкою, а «цього тижня» тепер означає від сьогодні до неділі й лише ті посилки, що ще їдуть. Збоку з'явився блок про найближчу доставку: коли вона буде, з якого магазину, якою службою і що всередині, а рядок під панеллю інструментів каже, скільки книг із загальної кількості зараз на екрані.",
    category: "improvement",
    publishedAt: "2026-08-18T00:00:01.000Z",
    slug: "delivery-in-transit-overview",
    titleEn: "Books in transit at a glance",
    titleUk: "Огляд книг у дорозі",
    version: null,
  },
  {
    bodyEn:
      "The Books in transit page now shows what your library gains once the parcels arrive, not just where they are. A side block counts the series that will finally be complete, the gaps in a series that will close, the queued books that become readable, the series you will be able to carry on, and the books that belong to an active reading goal. The three most useful lines are shown first, the rest open on request, and the block stays away when arriving books change nothing worth mentioning.",
    bodyUk:
      "Сторінка «Книги в дорозі» тепер показує не лише де посилки, а й що зміниться в бібліотеці, коли вони приїдуть. Збоку з’явився блок, який рахує серії, що нарешті стануть повними, прогалини в серіях, які закриються, книги з черги читання, які стануть доступними, серії, які можна буде продовжити, і книги, що входять до активних цілей. Спершу показані три найкорисніші рядки, решта відкриваються за запитом, а якщо отримання нічого не змінює, блока просто немає.",
    category: "feature",
    publishedAt: "2026-08-19T00:00:00.000Z",
    slug: "delivery-arrival-impact",
    titleEn: "What arriving will change",
    titleUk: "Що зміниться після отримання",
    version: null,
  },
  {
    bodyEn:
      "Books in transit now has a filter panel next to the quick filters. Narrow the list by store, order date, how many books are still on their way, delivery service, expected delivery date, whether an order travels in one parcel or several, currency, order total, and whether the total is recorded at all. Pick several stores or services and any of them counts; combine sections and all of them must hold. Nothing applies until you press Apply, the button carries a count of the sections in use, and a matched order keeps all of its parcels and books on the card. The order total on a card now comes from the whole order rather than the books on screen, so filtering the list no longer changes the sum.",
    bodyUk:
      "На сторінці «Книги в дорозі» поруч зі швидкими фільтрами з’явилася панель розширених. Звужуйте список за магазином, датою замовлення, кількістю книг, які ще їдуть, службою доставки, очікуваною датою, тим, чи їде замовлення однією посилкою чи кількома, валютою, вартістю замовлення та наявністю суми. Кілька магазинів або служб працюють як «будь-який із них», а різні секції складаються разом. Нічого не застосовується, доки ви не натиснете «Застосувати», на кнопці видно кількість задіяних секцій, а знайдене замовлення лишається на картці цілим - з усіма посилками й книгами. Сума замовлення на картці тепер рахується по всьому замовленню, а не по книгах на екрані, тож фільтрація списку більше не змінює її.",
    category: "feature",
    publishedAt: "2026-08-19T00:00:00.000Z",
    slug: "delivery-advanced-filters",
    titleEn: "Advanced filters for books in transit",
    titleUk: "Розширені фільтри для книг у дорозі",
    version: null,
  },
  {
    bodyEn:
      "Marking parcels as received on the Books in transit page now works in bulk. Selection moved from the page header to the toolbar next to sorting and filters, and the checkbox sits on each parcel that can still be received rather than on individual books. Pick several parcels and confirm: all of them are marked as arrived in one step together with the books they carry, and if one of them was received or cancelled in the meantime you are told. The bar at the bottom shows how many parcels are selected and how many books they hold. Books not yet assigned to a parcel are not selectable here, because there is nothing physical to confirm as arrived; they are still received one at a time from the book's own page.",
    bodyUk:
      "Позначати посилки отриманими на сторінці «Книги в дорозі» тепер можна групою. Режим вибору переїхав із шапки сторінки на панель інструментів поруч із сортуванням і фільтрами, а прапорець стоїть на кожній посилці, яку ще можна отримати, а не на окремих книгах. Оберіть кілька посилок і підтвердьте: усі вони стануть отриманими за один раз разом із книгами, які везуть, а якщо якусь тим часом уже отримали або скасували, ви побачите про це повідомлення. Внизу видно, скільки посилок вибрано і скільки в них книг. Книги, ще не розподілені між посилками, тут не вибираються, бо підтверджувати прибуття нема чого: їх, як і раніше, отримують поодинці зі сторінки книги.",
    category: "improvement",
    publishedAt: "2026-08-19T00:00:00.000Z",
    slug: "delivery-bulk-receive-parcels",
    titleEn: "Receiving parcels in bulk",
    titleUk: "Групове отримання посилок",
    version: null,
  },
  {
    bodyEn:
      "Every order now carries a currency and a single final total, so an order card can no longer show a dash where the price belongs. A free order became a state you pick yourself, instead of a zero that looked the same as a price nobody had entered. Books that arrived free but with paid delivery stay an ordinary order with a book price of zero. The old sum known and sum not known filter and the line about how many totals were recorded are gone, because there is nothing left for them to say.",
    bodyUk:
      "Кожне замовлення тепер має валюту й одну підсумкову суму, тож на картці більше не буває прочерку там, де мала стояти ціна. Безкоштовне замовлення стало окремим станом, який ви обираєте самі, замість нуля, що його не відрізниш від невведеної ціни. Книги, які приїхали безкоштовно, але з платною доставкою, лишаються звичайним замовленням із ціною книги нуль. Фільтр «сума відома / сума невідома» та рядок про повноту сум прибрані, бо їм більше нема чого сказати.",
    category: "improvement",
    publishedAt: "2026-08-19T00:00:01.000Z",
    slug: "order-total-and-free",
    titleEn: "Every order has a final total",
    titleUk: "Кожне замовлення має підсумкову суму",
    version: null,
  },
  {
    bodyEn:
      "The delivery history page is no longer a flat list of books: rows are grouped into orders, then parcels, then the books inside them, so it is clear when several books arrived together. The received tab gained its own side block with the latest receipt, the received books still waiting to be read, and what the receipt changed in your series. Filtering moved to the same side panel the active deliveries use, where store, delivery service and currency now take several values at once, alongside new filters for book count and for receipt and cancellation dates. The cancelled tab now says both what a cancelled book still needs from you and where those books ended up: bought later, reordered, back on the wishlist, borrowed from someone, or still undecided. Comments written on an order and on a parcel are finally visible on the cards.",
    bodyUk:
      "Сторінка «Історія доставок» більше не плаский перелік книг: рядки згруповані в замовлення, посилки та книги всередині них, тож видно, коли кілька книг приїхали разом. На вкладці отриманих збоку з’явився власний блок: останнє отримання, отримані книги, які ще чекають на прочитання, і те, що отримання змінило в серіях. Фільтри переїхали в ту саму бічну панель, що й у списку активних доставок: магазин, служба доставки та валюта тепер приймають кілька значень одразу, а поруч з’явилися кількість книг і дати отримання та скасування. Вкладка скасованих тепер каже і що зі скасованою книгою робити далі, і чим усе скінчилося: книгу купили пізніше, замовили знову, повернули до списку бажань, позичили в когось чи так і не вирішили. Коментарі, написані до замовлення й до посилки, нарешті видно на картках.",
    category: "improvement",
    publishedAt: "2026-08-20T00:00:00.000Z",
    slug: "delivery-history-rework",
    titleEn: "Reworked delivery history",
    titleUk: "Оновлена історія доставок",
    version: null,
  },
  {
    bodyEn:
      "The spending statistics page is now a dashboard you can decide from. Pick a period and, if you want, compare it with the previous one or with the same stretch last year. Four headline numbers sit on top: what you spent, what is still on its way, the average book price and the average order. Below them the page shows where the money actually goes once delivery and discounts are counted, where orders are stuck and for how long, which store is the better deal, and which month cost the most. Every amount keeps UAH, EUR and USD on separate scales and never adds them together, and almost everything on the page is a way into the filtered lists, with the back button bringing the statistics back as you left them.",
    bodyUk:
      "Сторінка статистики витрат стала панеллю, за якою можна ухвалювати рішення. Оберіть період і за бажанням порівняйте його з попереднім або з тим самим відрізком торік. Угорі чотири головні числа: скільки витрачено, скільки ще їде, середня ціна книги та середнє замовлення. Нижче видно, куди насправді йдуть гроші з урахуванням доставки та знижок, де й наскільки застрягли замовлення, який магазин вигідніший і який місяць вийшов найдорожчим. Кожна сума тримає гривні, євро та долари на окремих шкалах і ніколи не складає їх разом, а майже кожен блок веде до відфільтрованих списків, і кнопка «Назад» повертає статистику такою, якою ви її залишили.",
    category: "feature",
    publishedAt: "2026-08-21T00:00:00.000Z",
    slug: "order-spending-statistics",
    titleEn: "Book spending statistics",
    titleUk: "Статистика витрат на книги",
    version: null,
  },
  {
    bodyEn:
      "You can now set a monthly book budget on the statistics page, separately for each currency. The page shows how much of the month is already spent against it, and a forecast for the end of the month while it is still running. Changing the budget opens a new version instead of rewriting the old one, so a month that has already ended keeps the amount it was actually judged against. A budget planned for a future month can be cancelled before it starts.",
    bodyUk:
      "На сторінці статистики тепер можна задати місячний бюджет на книги окремо для кожної валюти. Видно, наскільки місяць уже його вибрав, і прогноз на його кінець, поки місяць ще триває. Зміна бюджету не переписує старий, а відкриває нову версію, тож місяць, який уже завершився, зберігає ту суму, за якою його й оцінювали. Бюджет, запланований на майбутній місяць, можна скасувати, доки він не почався.",
    category: "feature",
    publishedAt: "2026-08-21T00:00:01.000Z",
    slug: "monthly-book-budget",
    titleEn: "Monthly book budget",
    titleUk: "Місячний бюджет на книги",
    version: null,
  },
  {
    bodyEn:
      "The person you lend books to is now a thing of its own, not a name retyped on every loan. There is a page listing all of them, with search and a split between active and archived, and a person's card opens from every place their name appears: an active loan row, a history row and the sidebar blocks. The card holds how to reach them, which of your books they are holding, what you still owe them and how their past loans ended. A new loan can start from there instead of from a book, and someone you no longer lend to can be archived, with all of their past loans left untouched. The loans you already had were matched to the people they named, so nothing had to be entered again.",
    bodyUk:
      "Людина, якій ви позичаєте книги, тепер існує сама по собі, а не як ім'я, що його доводилося вводити наново на кожній позиці. З'явилася окрема сторінка з переліком усіх таких людей, із пошуком і поділом на активних та архівних, а картка людини відкривається з кожного місця, де стоїть її ім'я: з рядка активної позики, з історії позик і з бічних блоків. У картці видно, як із людиною зв'язатися, які ваші книги вона тримає зараз, що ви винні їй і чим закінчилися минулі позики. Звідти ж можна почати нову позику, не шукаючи спершу книгу, а того, кому ви більше не позичаєте, можна відправити в архів, і всі його минулі позики лишаються на місці. Наявні позики самі підв'язалися до людей, яких вони називали, тож вводити щось наново не довелося.",
    category: "feature",
    publishedAt: "2026-08-21T00:00:02.000Z",
    slug: "loan-contacts",
    titleEn: "The people you lend to",
    titleUk: "Люди, яким ви позичаєте",
    version: null,
  },
  {
    bodyEn:
      "A statistics page now shows how your reading went over a period you choose: how many reads you finished and pages you got through, how that compares with the period before, which genres, authors, publishers and languages you read most, how your ratings are spread, which books were new discoveries and which records you set. Pick a calendar year, the last 12 months, your own dates or all time.",
    bodyUk:
      "З'явилася окрема сторінка статистики: за обраний період видно, скільки читань ви завершили і скільки сторінок прочитали, як це виглядає поруч із попереднім періодом, які жанри, авторів, видавництва й мови ви читаєте найчастіше, як розподілилися ваші оцінки, що стало новим відкриттям і які рекорди ви поставили. Період беріть за календарний рік, за останні 12 місяців, за власні дати або за весь час.",
    category: "feature",
    publishedAt: "2026-09-06T00:00:00.000Z",
    slug: "reading-statistics",
    titleEn: "Reading statistics",
    titleUk: "Статистика читання",
    version: null,
  },
  {
    bodyEn:
      "Statistics carry a calendar of the days you actually read, with your longest and current streaks and your most active weekday. Click any day to see what you were reading then, or switch the calendar from activity to books to read the period as a diary.",
    bodyUk:
      "У статистиці є календар днів, коли ви справді читали: найдовша і поточна серії днів поспіль та найактивніший день тижня. Клік по дню показує, що ви читали того дня, а перемикач з активності на книги перетворює календар на читацький щоденник.",
    category: "feature",
    publishedAt: "2026-09-06T00:00:01.000Z",
    slug: "reading-calendar",
    titleEn: "Reading calendar",
    titleUk: "Читацький календар",
    version: null,
  },
  {
    bodyEn:
      "You can now hand over several books to one person in one go: pick every book in the loan dialog and set the date, the return term and the reminder once, and a loan is recorded for each book.",
    bodyUk:
      "Тепер можна передати людині кілька книг за один раз: оберіть у вікні позики всі потрібні книги, а дату, термін повернення й нагадування вкажіть один раз, і запис створиться для кожної книги.",
    category: "feature",
    publishedAt: "2026-09-06T00:00:02.000Z",
    slug: "loan-batch-lend",
    titleEn: "Lending several books at once",
    titleUk: "Позика кількох книг одразу",
    version: null,
  },
  {
    bodyEn:
      "The lent and borrowed pages now filter by person, by loan date, by return term, by whether a reminder is set and by whether a note is there. Everything you pick shows up as a chip above the list and can be dropped one at a time.",
    bodyUk:
      "На сторінках «Треба повернути» та «Передано іншим» з'явилися фільтри за людиною, за датою позики, за терміном повернення, за наявністю нагадування і за наявністю нотатки. Усе обране стоїть чипами над списком, і кожен знімається окремо.",
    category: "feature",
    publishedAt: "2026-09-06T00:00:03.000Z",
    slug: "loans-advanced-filters",
    titleEn: "Advanced loan filters",
    titleUk: "Розширені фільтри позик",
    version: null,
  },
  {
    bodyEn:
      "Loan history now filters the way the active loan pages do: by direction, by person, by loan date and by return date, with quick filters for returned on time, returned late and returned with no deadline. A line above the list says how many records you are seeing out of the total.",
    bodyUk:
      "Історія позик тепер фільтрується так само, як активні позики: за напрямком, за людиною, за датою позики та за датою повернення, а швидкі фільтри ділять список на повернені вчасно, із запізненням і без визначеного строку. Над списком видно, скільки записів показано із загальної кількості.",
    category: "feature",
    publishedAt: "2026-09-06T00:00:04.000Z",
    slug: "loan-history-filters",
    titleEn: "Loan history filters",
    titleUk: "Фільтри в історії позик",
    version: null,
  },
  {
    bodyEn:
      "While you record a loan, the caption next to each name says how many books that person is holding right now, or how many you took from them, instead of counting every loan ever. The list of people also scrolls all the way to the last name instead of stopping at the eighth.",
    bodyUk:
      "Коли ви записуєте позику, біля кожного імені видно, скільки книг ця людина тримає зараз або скільки ви взяли в неї, а не скільки позик було за весь час. Список людей тепер гортається до останнього імені, а не обривається на восьмому.",
    category: "improvement",
    publishedAt: "2026-09-06T00:00:05.000Z",
    slug: "loan-contact-holdings",
    titleEn: "Books a person is holding now",
    titleUk: "Скільки книг людина тримає зараз",
    version: null,
  },
  {
    bodyEn:
      "The people list now opens on your active contacts only. Archived people sit behind the Filters button, and when you bring them back a removable chip above the list says so, so it is always clear why someone is missing.",
    bodyUk:
      "Список людей тепер відкривається лише на активних контактах. Архівовані сховані за кнопкою «Фільтри», а коли ви їх вмикаєте, над списком стоїть знімний чип, тож завжди зрозуміло, чому когось не видно.",
    category: "improvement",
    publishedAt: "2026-09-06T00:00:06.000Z",
    slug: "loan-contacts-active-by-default",
    titleEn: "Contacts without the archived ones",
    titleUk: "Контакти без архівованих",
    version: null,
  },
  {
    bodyEn:
      "The returned-on-time card divided by every finished loan, including the ones that never had a deadline, so the share came out lower than it really was. It now counts only loans that had a deadline, and if none of them did the card says so instead of showing zero. The average duration shows a dash when there is too little data, where it used to read as zero days.",
    bodyUk:
      "Картка «Повернуто вчасно» рахувала відсоток від усіх завершених позик, зокрема тих, яким ви ніколи не ставили строку, тож частка виходила меншою за справжню. Тепер вона рахується лише серед позик зі строком, а якщо строку не було в жодної, картка так і каже замість нуля. Середня тривалість показує прочерк, коли даних замало, замість «0 днів».",
    category: "fix",
    publishedAt: "2026-09-06T00:00:07.000Z",
    slug: "loan-on-time-share",
    titleEn: "The on-time return share",
    titleUk: "Частка вчасних повернень",
    version: null,
  },
  {
    bodyEn:
      "Creating a new person while you record a loan no longer opens a second window on top of the first one: the form appears as a step inside the dialog you are already in. The date, note and reminder you have already filled in are kept, where stepping back used to wipe them.",
    bodyUk:
      "Створення нової людини під час запису позики більше не відкриває друге вікно поверх першого: форма з'являється кроком у тому самому вікні. Дата, нотатка й нагадування, які ви вже заповнили, зберігаються, хоча раніше крок назад стирав їх.",
    category: "fix",
    publishedAt: "2026-09-06T00:00:08.000Z",
    slug: "loan-contact-inline-create",
    titleEn: "Adding a person inside the loan dialog",
    titleUk: "Нова людина просто у вікні позики",
    version: null,
  },
  {
    bodyEn:
      "The spending statistics page now lets you choose the currency the money figures are shown in, and every amount and chart switches together. Nothing is converted: the page shows exactly what you spent in the currency you picked.",
    bodyUk:
      "На сторінці статистики витрат можна обрати валюту, у якій показувати гроші, і всі суми та графіки перемикаються разом. Суми не конвертуються: сторінка показує саме те, що ви витратили в обраній валюті.",
    category: "improvement",
    publishedAt: "2026-09-06T00:00:09.000Z",
    slug: "spending-statistics-currency",
    titleEn: "Currency for the spending statistics",
    titleUk: "Валюта показників у статистиці витрат",
    version: null,
  },
  {
    bodyEn:
      "Figures on the spending statistics page are clickable now: a click opens exactly the orders the figure was built from, split into in transit, received and cancelled, with a count beside each.",
    bodyUk:
      "Числа на сторінці статистики витрат тепер клікабельні: клік відкриває саме ті замовлення, з яких це число склалося, поділені на ті, що в дорозі, отримані та скасовані, з кількістю біля кожної групи.",
    category: "feature",
    publishedAt: "2026-09-06T00:00:10.000Z",
    slug: "spending-statistics-drilldown",
    titleEn: "From a figure to the orders behind it",
    titleUk: "Від числа до замовлень",
    version: null,
  },
  {
    bodyEn:
      "A change to the monthly book budget can now start from a month you choose instead of the current one, and you can just as well plan for a currency to stop having a budget from a given month. Scheduled changes are listed on the budget card, and each one can be cancelled before it takes effect.",
    bodyUk:
      "Зміну місячного бюджету на книги тепер можна застосувати з обраного місяця, а не лише з поточного, і так само можна запланувати, що з певного місяця бюджету в цій валюті не буде. Заплановані зміни перелічені на картці бюджету, і кожну можна скасувати, поки вона не набула чинності.",
    category: "improvement",
    publishedAt: "2026-09-06T00:00:11.000Z",
    slug: "book-budget-scheduled-changes",
    titleEn: "Planning the book budget ahead",
    titleUk: "Бюджет на книги наперед",
    version: null,
  },
  {
    bodyEn:
      "Clicking into the publisher field while you add or edit a book no longer closes the suggestion list that has just opened.",
    bodyUk:
      "Клік у поле видавництва, коли ви додаєте чи редагуєте книгу, більше не закриває підказки, які щойно відкрилися.",
    category: "fix",
    publishedAt: "2026-09-06T00:00:12.000Z",
    slug: "publisher-picker-stays-open",
    titleEn: "The publisher list stays open",
    titleUk: "Список видавництв не закривається",
    version: null,
  },
];

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

async function seedChangelog(): Promise<void> {
  const prisma = createSeedClient();

  try {
    await seedEntries(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function seedEntries(prisma: PrismaClientInstance): Promise<void> {
  const slugs = CHANGELOG_ENTRIES.map((entry) => entry.slug);
  const existing = await prisma.changelogEntry.findMany({
    select: { slug: true },
    where: { slug: { in: slugs } },
  });
  const existingSlugs = new Set(existing.map((row) => row.slug));

  for (const entry of CHANGELOG_ENTRIES) {
    const publishedAt = parseISO(entry.publishedAt);
    await prisma.changelogEntry.upsert({
      create: {
        bodyEn: entry.bodyEn,
        bodyUk: entry.bodyUk,
        category: entry.category,
        publishedAt,
        slug: entry.slug,
        titleEn: entry.titleEn,
        titleUk: entry.titleUk,
        version: entry.version,
      },
      update: {
        bodyEn: entry.bodyEn,
        bodyUk: entry.bodyUk,
        category: entry.category,
        publishedAt,
        titleEn: entry.titleEn,
        titleUk: entry.titleUk,
        version: entry.version,
      },
      where: { slug: entry.slug },
    });
  }

  const created = CHANGELOG_ENTRIES.filter((entry) => !existingSlugs.has(entry.slug)).length;
  logger.info({ created, updated: CHANGELOG_ENTRIES.length - created }, "changelog entries seeded");
}

seedChangelog()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    logger.error({ error: String(error) }, "changelog seed failed");
    process.exit(1);
  });
