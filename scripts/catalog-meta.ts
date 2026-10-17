/**
 * Facts the Google Sheet doesn't carry: MCU phases, story order, the canon split, and titles
 * missing from the sheet. Phases and dates checked against Wikipedia's MCU film/TV lists (Oct 2026).
 */
import type { Collection, PartialDate, TitleType, Universe } from '../src/lib/types.ts'

/**
 * Marvel's Netflix shows. Disney+ lists all of them in its official MCU timeline order (2024), and
 * Marvel Studios has called them part of the Sacred Timeline, so they count as MCU.
 */
export const NETFLIX_DEFENDERS = new Set(['Daredevil', 'Jessica Jones', 'Luke Cage', 'Iron Fist', 'The Defenders', 'The Punisher'])

/** Other Marvel Television shows (ABC, Hulu, Freeform): not on Disney+'s MCU timeline, so Other Marvel. */
export const LEGACY_MARVEL_TV = new Set(['Agents of S.H.I.E.L.D.', 'Agent Carter', 'Inhumans', 'Runaways', 'Cloak & Dagger', 'Helstrom'])

/** Sheet sagas outside Marvel Studios, and the group each belongs to. */
export const COLLECTION_BY_SAGA: Record<string, Collection> = {
  'X-Men': 'fox-xmen',
  'Spider-Man': 'sony-spider-man',
}

/** Sheet "Phase" column values → saga names used in the app. */
export const SAGA_NAMES: Record<string, string> = {
  'Infinity Saga': 'Infinity Saga',
  'Multiverse Saga': 'Multiverse Saga',
  'X-Men': 'X-Men',
  'Spider Man': 'Spider-Man',
}

export const STUDIO_BY_SAGA: Record<string, string> = {
  'X-Men': '20th Century Fox',
  'Spider-Man': 'Sony Pictures',
}

export const MCU_PHASE: Record<string, number> = {
  'Iron Man': 1,
  'The Incredible Hulk': 1,
  'Iron Man 2': 1,
  Thor: 1,
  'Captain America: The First Avenger': 1,
  'The Avengers': 1,
  'Iron Man 3': 2,
  'Thor: The Dark World': 2,
  'Captain America: The Winter Soldier': 2,
  'Guardians of the Galaxy': 2,
  'Avengers: Age of Ultron': 2,
  'Ant-Man': 2,
  'Captain America: Civil War': 3,
  'Doctor Strange': 3,
  'Guardians of the Galaxy Vol. 2': 3,
  'Spider-Man: Homecoming': 3,
  'Thor: Ragnarok': 3,
  'Black Panther': 3,
  'Avengers: Infinity War': 3,
  'Ant-Man and the Wasp': 3,
  'Captain Marvel': 3,
  'Avengers: Endgame': 3,
  'Spider-Man: Far From Home': 3,
  WandaVision: 4,
  'The Falcon and the Winter Soldier': 4,
  Loki: 4,
  'Black Widow': 4,
  'What If...?': 4,
  'Shang-Chi and the Legend of the Ten Rings': 4,
  Eternals: 4,
  Hawkeye: 4,
  'Spider-Man: No Way Home': 4,
  'Moon Knight': 4,
  'Doctor Strange in the Multiverse of Madness': 4,
  'Ms. Marvel': 4,
  'Thor: Love and Thunder': 4,
  'She-Hulk: Attorney at Law': 4,
  'Werewolf by Night': 4,
  'Black Panther: Wakanda Forever': 4,
  'The Guardians of the Galaxy Holiday Special': 4,
  'Ant-Man and the Wasp: Quantumania': 5,
  'Guardians of the Galaxy Vol. 3': 5,
  'Secret Invasion': 5,
  'The Marvels': 5,
  Echo: 5,
  'Deadpool & Wolverine': 5,
  'Agatha All Along': 5,
  'Your Friendly Neighborhood Spider-Man': 5,
  'Captain America: Brave New World': 5,
  'Daredevil: Born Again': 5,
  'Thunderbolts*': 5,
  Ironheart: 5,
  'Eyes of Wakanda': 5,
  'Marvel Zombies': 5,
  'The Fantastic Four: First Steps': 6,
  'Wonder Man': 6,
  'Spider-Man: Brand New Day': 6,
  VisionQuest: 6,
  'Avengers: Doomsday': 6,
  'Avengers: Secret Wars': 6,
}

/** Seasons whose phase differs from their show's first season. Keyed by show, then season number. */
export const SEASON_PHASE: Record<string, Record<number, number>> = {
  Loki: { 2: 5 },
  'What If...?': { 2: 5, 3: 5 },
  'Your Friendly Neighborhood Spider-Man': { 2: 6 },
  'Daredevil: Born Again': { 2: 6, 3: 6 },
  'I Am Groot': { 2: 5 },
}

/**
 * MCU story order, approximating Disney+'s timeline order. Alternate-universe titles
 * (Marvel Zombies, Your Friendly Neighborhood Spider-Man, Fantastic Four's Earth-828) sit near the end.
 */
export const MCU_CHRONO_ORDER = [
  'Eyes of Wakanda',
  'Captain America: The First Avenger',
  'Agent Carter (One-Shot)',
  'Captain Marvel',
  'Iron Man',
  'Iron Man 2',
  'The Incredible Hulk',
  'The Consultant',
  "A Funny Thing Happened on the Way to Thor's Hammer",
  'Thor',
  'The Avengers',
  'Item 47',
  'Thor: The Dark World',
  'Iron Man 3',
  'All Hail the King',
  'Captain America: The Winter Soldier',
  'Guardians of the Galaxy',
  'Guardians of the Galaxy Vol. 2',
  'I Am Groot',
  // Netflix shows placed where Disney+'s MCU timeline order puts them.
  'Daredevil',
  'Jessica Jones',
  'Avengers: Age of Ultron',
  'Ant-Man',
  'Luke Cage',
  'Iron Fist',
  'The Defenders',
  'Captain America: Civil War',
  'Black Widow',
  'Black Panther',
  'Spider-Man: Homecoming',
  'The Punisher',
  'Doctor Strange',
  'Thor: Ragnarok',
  'Ant-Man and the Wasp',
  'Avengers: Infinity War',
  'Avengers: Endgame',
  'Loki',
  'What If...?',
  'WandaVision',
  'The Falcon and the Winter Soldier',
  'Spider-Man: Far From Home',
  'Shang-Chi and the Legend of the Ten Rings',
  'Eternals',
  'Spider-Man: No Way Home',
  'Hawkeye',
  'Moon Knight',
  'Doctor Strange in the Multiverse of Madness',
  'Ms. Marvel',
  'Thor: Love and Thunder',
  'Werewolf by Night',
  'Black Panther: Wakanda Forever',
  'She-Hulk: Attorney at Law',
  'The Guardians of the Galaxy Holiday Special',
  'Echo',
  'Ant-Man and the Wasp: Quantumania',
  'Guardians of the Galaxy Vol. 3',
  'The Marvels',
  'Secret Invasion',
  'Agatha All Along',
  'Daredevil: Born Again',
  'Captain America: Brave New World',
  'Thunderbolts*',
  'Ironheart',
  'The Punisher: One Last Kill',
  'Deadpool & Wolverine',
  'Wonder Man',
  'Spider-Man: Brand New Day',
  'VisionQuest',
  'Your Friendly Neighborhood Spider-Man',
  'Marvel Zombies',
  'The Fantastic Four: First Steps',
  'Avengers: Doomsday',
  'Avengers: Secret Wars',
]

/** Corrections to sheet season rows, keyed by show then season number. */
export const SEASON_CORRECTIONS: Record<string, Record<number, { premiereDate?: PartialDate; note?: string }>> = {
  // Sheet said "Fall 2026 (TBA)"; Disney+ has since dated it.
  'Your Friendly Neighborhood Spider-Man': { 2: { premiereDate: '2027-01-13' } },
}

export interface ExtraSeason {
  label?: string
  episodeCount: number | null
  premiereDate: PartialDate | null
}

export interface ExtraTitle {
  title: string
  type: TitleType
  releaseDate: PartialDate | null
  universe: Universe
  collection: Collection
  saga: string
  phase?: number
  studio: string
  seasons?: ExtraSeason[]
  note?: string
}

/** Seasons to append to shows already in the sheet. */
export const EXTRA_SEASONS: Record<string, ExtraSeason[]> = {
  'Daredevil: Born Again': [{ episodeCount: 8, premiereDate: '2027-03' }],
}

export const EXTRA_TITLES: ExtraTitle[] = [
  // MCU canon: Marvel One-Shots (Blu-ray shorts) and shorts series
  { title: 'The Consultant', type: 'special', releaseDate: '2011-09-13', collection: 'marvel-studios', universe: 'mcu', saga: 'Infinity Saga', phase: 1, studio: 'Marvel Studios', note: 'Marvel One-Shot' },
  { title: "A Funny Thing Happened on the Way to Thor's Hammer", type: 'special', releaseDate: '2011-10-25', collection: 'marvel-studios', universe: 'mcu', saga: 'Infinity Saga', phase: 1, studio: 'Marvel Studios', note: 'Marvel One-Shot' },
  { title: 'Item 47', type: 'special', releaseDate: '2012-09-25', collection: 'marvel-studios', universe: 'mcu', saga: 'Infinity Saga', phase: 1, studio: 'Marvel Studios', note: 'Marvel One-Shot' },
  { title: 'Agent Carter (One-Shot)', type: 'special', releaseDate: '2013-09-24', collection: 'marvel-studios', universe: 'mcu', saga: 'Infinity Saga', phase: 2, studio: 'Marvel Studios', note: 'Marvel One-Shot' },
  { title: 'All Hail the King', type: 'special', releaseDate: '2014-02-04', collection: 'marvel-studios', universe: 'mcu', saga: 'Infinity Saga', phase: 2, studio: 'Marvel Studios', note: 'Marvel One-Shot' },
  {
    title: 'I Am Groot', type: 'series', releaseDate: '2022-08-10', collection: 'marvel-studios', universe: 'mcu', saga: 'Multiverse Saga', phase: 4, studio: 'Marvel Studios', note: 'Animated shorts',
    seasons: [
      { episodeCount: 5, premiereDate: '2022-08-10' },
      { episodeCount: 5, premiereDate: '2023-09-06' },
    ],
  },
  { title: 'The Punisher: One Last Kill', type: 'special', releaseDate: '2026-05-12', collection: 'marvel-studios', universe: 'mcu', saga: 'Multiverse Saga', phase: 6, studio: 'Marvel Studios', note: 'Special presentation' },

  // Other Marvel: Sony
  { title: 'Venom', type: 'movie', releaseDate: '2018-10-05', collection: 'sony-spider-man', universe: 'other', saga: 'Spider-Man', studio: 'Sony Pictures' },
  { title: 'Spider-Man: Into the Spider-Verse', type: 'movie', releaseDate: '2018-12-14', collection: 'sony-spider-man', universe: 'other', saga: 'Spider-Man', studio: 'Sony Pictures Animation' },
  { title: 'Venom: Let There Be Carnage', type: 'movie', releaseDate: '2021-10-01', collection: 'sony-spider-man', universe: 'other', saga: 'Spider-Man', studio: 'Sony Pictures' },
  { title: 'Morbius', type: 'movie', releaseDate: '2022-04-01', collection: 'sony-spider-man', universe: 'other', saga: 'Spider-Man', studio: 'Sony Pictures' },
  { title: 'Spider-Man: Across the Spider-Verse', type: 'movie', releaseDate: '2023-06-02', collection: 'sony-spider-man', universe: 'other', saga: 'Spider-Man', studio: 'Sony Pictures Animation' },
  { title: 'Madame Web', type: 'movie', releaseDate: '2024-02-14', collection: 'sony-spider-man', universe: 'other', saga: 'Spider-Man', studio: 'Sony Pictures' },
  { title: 'Venom: The Last Dance', type: 'movie', releaseDate: '2024-10-25', collection: 'sony-spider-man', universe: 'other', saga: 'Spider-Man', studio: 'Sony Pictures' },
  { title: 'Kraven the Hunter', type: 'movie', releaseDate: '2024-12-13', collection: 'sony-spider-man', universe: 'other', saga: 'Spider-Man', studio: 'Sony Pictures' },

  // Other Marvel: classic pre-MCU films
  { title: 'The Punisher', type: 'movie', releaseDate: '1989', collection: 'classic', universe: 'other', saga: 'Classic Marvel', studio: 'New World Pictures' },
  { title: 'Blade', type: 'movie', releaseDate: '1998-08-21', collection: 'classic', universe: 'other', saga: 'Classic Marvel', studio: 'New Line Cinema' },
  { title: 'Blade II', type: 'movie', releaseDate: '2002-03-22', collection: 'classic', universe: 'other', saga: 'Classic Marvel', studio: 'New Line Cinema' },
  { title: 'Daredevil', type: 'movie', releaseDate: '2003-02-14', collection: 'classic', universe: 'other', saga: 'Classic Marvel', studio: '20th Century Fox' },
  { title: 'Hulk', type: 'movie', releaseDate: '2003-06-20', collection: 'classic', universe: 'other', saga: 'Classic Marvel', studio: 'Universal Pictures' },
  { title: 'The Punisher', type: 'movie', releaseDate: '2004-04-16', collection: 'classic', universe: 'other', saga: 'Classic Marvel', studio: 'Lionsgate' },
  { title: 'Blade: Trinity', type: 'movie', releaseDate: '2004-12-08', collection: 'classic', universe: 'other', saga: 'Classic Marvel', studio: 'New Line Cinema' },
  { title: 'Elektra', type: 'movie', releaseDate: '2005-01-14', collection: 'classic', universe: 'other', saga: 'Classic Marvel', studio: '20th Century Fox' },
  { title: 'Fantastic Four', type: 'movie', releaseDate: '2005-07-08', collection: 'classic', universe: 'other', saga: 'Classic Marvel', studio: '20th Century Fox' },
  { title: 'Ghost Rider', type: 'movie', releaseDate: '2007-02-16', collection: 'classic', universe: 'other', saga: 'Classic Marvel', studio: 'Sony Pictures' },
  { title: 'Fantastic Four: Rise of the Silver Surfer', type: 'movie', releaseDate: '2007-06-15', collection: 'classic', universe: 'other', saga: 'Classic Marvel', studio: '20th Century Fox' },
  { title: 'Punisher: War Zone', type: 'movie', releaseDate: '2008-12-05', collection: 'classic', universe: 'other', saga: 'Classic Marvel', studio: 'Lionsgate' },
  { title: 'Ghost Rider: Spirit of Vengeance', type: 'movie', releaseDate: '2012-02-17', collection: 'classic', universe: 'other', saga: 'Classic Marvel', studio: 'Sony Pictures' },
  { title: 'Fantastic Four', type: 'movie', releaseDate: '2015-08-07', collection: 'classic', universe: 'other', saga: 'Classic Marvel', studio: '20th Century Fox' },

  // Other Marvel: X-Men TV
  {
    title: 'Legion', type: 'series', releaseDate: '2017-02-08', collection: 'fox-xmen', universe: 'other', saga: 'X-Men', studio: 'Marvel Television',
    seasons: [
      { episodeCount: 8, premiereDate: '2017-02-08' },
      { episodeCount: 11, premiereDate: '2018-04-03' },
      { episodeCount: 8, premiereDate: '2019-06-24' },
    ],
  },
  {
    title: 'The Gifted', type: 'series', releaseDate: '2017-10-02', collection: 'fox-xmen', universe: 'other', saga: 'X-Men', studio: 'Marvel Television',
    seasons: [
      { episodeCount: 13, premiereDate: '2017-10-02' },
      { episodeCount: 16, premiereDate: '2018-09-25' },
    ],
  },
  {
    title: "X-Men '97", type: 'series', releaseDate: '2024-03-20', collection: 'classic', universe: 'other', saga: 'X-Men', studio: 'Marvel Studios Animation',
    seasons: [{ episodeCount: 10, premiereDate: '2024-03-20' }],
  },
]
