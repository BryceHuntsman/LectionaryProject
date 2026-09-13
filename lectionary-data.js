(function () {
// Liturgical calendar math: Easter (Computus), derived movable feasts,
// season boundaries, and the Sunday reading cycle (A/B/C) for a given year.
//
// "Year" here means the calendar year in which the liturgical year *ends*
// (e.g. the liturgical year that starts Advent 2024 and runs through
// Christ the King 2025 is referred to as 2025).

const LiturgicalCalendar = (() => {

  function utcDate(y, m, d) {
    return new Date(Date.UTC(y, m - 1, d));
  }

  function addDays(date, n) {
    const d = new Date(date.getTime());
    d.setUTCDate(d.getUTCDate() + n);
    return d;
  }

  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
  function computeEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return utcDate(year, month, day);
  }

  // Sunday on/after `date`.
  function sundayOnOrAfter(date) {
    const d = new Date(date.getTime());
    const dow = d.getUTCDay(); // 0 = Sunday
    return dow === 0 ? d : addDays(d, 7 - dow);
  }

  // Sunday nearest `date` (used for Advent 1: Sunday nearest Nov 30).
  function sundayNearest(date) {
    const d = new Date(date.getTime());
    const dow = d.getUTCDay();
    const forward = (7 - dow) % 7;
    const back = dow;
    return back <= forward ? addDays(d, -back) : addDays(d, forward);
  }

  // Sunday Cycle: A/B/C, keyed off the ending calendar year of the liturgical year.
  function sundayCycle(endYear) {
    const r = endYear % 3;
    if (r === 1) return "A";
    if (r === 2) return "B";
    return "C";
  }

  // Full set of computed dates/season boundaries for the liturgical year
  // ending in `endYear` (i.e. Advent begins in endYear - 1).
  function getLiturgicalYear(endYear) {
    const easter = computeEaster(endYear);
    const ashWednesday = addDays(easter, -46);
    const palmSunday = addDays(easter, -7);
    const holyThursday = addDays(easter, -3);
    const goodFriday = addDays(easter, -2);
    const easterVigil = addDays(easter, -1);
    const ascension = addDays(easter, 39); // Thursday; many US dioceses transfer to the following Sunday
    const ascensionSunday = addDays(easter, 42);
    const pentecost = addDays(easter, 49);
    const trinitySunday = addDays(easter, 56);
    const corpusChristi = addDays(easter, 63); // Sunday form

    const christmas = utcDate(endYear - 1, 12, 25);
    const advent1 = sundayNearest(utcDate(endYear - 1, 11, 30));
    const epiphany = utcDate(endYear, 1, 6); // fixed date; many places transfer to nearest Sunday
    const baptismOfLord = addDays(sundayOnOrAfter(epiphany), 0);

    // Ordinary Time I: day after Baptism of the Lord -> day before Ash Wednesday
    const ot1Start = addDays(baptismOfLord, 1);
    const ot1End = addDays(ashWednesday, -1);

    // Ordinary Time II: day after Pentecost -> day before Advent 1 of next liturgical year
    const nextAdvent1 = sundayNearest(utcDate(endYear, 11, 30));
    const ot2Start = addDays(pentecost, 1);
    const ot2End = addDays(nextAdvent1, -1);

    const christTheKing = addDays(nextAdvent1, -7);

    return {
      endYear,
      cycle: sundayCycle(endYear),
      dates: {
        advent1, christmas, epiphany, baptismOfLord,
        ashWednesday, palmSunday, holyThursday, goodFriday, easterVigil, easter,
        ascension, ascensionSunday, pentecost, trinitySunday, corpusChristi,
        christTheKing, nextAdvent1
      },
      seasons: [
        { key: "advent", label: "Advent", start: advent1, end: addDays(christmas, -1), color: "violet" },
        { key: "christmas", label: "Christmas", start: christmas, end: addDays(baptismOfLord, 0), color: "white" },
        { key: "ot1", label: "Ordinary Time", start: ot1Start, end: ot1End, color: "green" },
        { key: "lent", label: "Lent", start: ashWednesday, end: addDays(holyThursday, -1), color: "violet" },
        { key: "triduum", label: "Triduum", start: holyThursday, end: addDays(easter, -1), color: "red" },
        { key: "easter", label: "Easter", start: easter, end: pentecost, color: "white" },
        { key: "ot2", label: "Ordinary Time", start: ot2Start, end: ot2End, color: "green" }
      ]
    };
  }

  // Position a date as a fraction [0,1) of the way around the wheel for
  // the liturgical year it belongs to (Advent 1 = 0).
  function fractionOfYear(date, liturgicalYear) {
    const start = liturgicalYear.dates.advent1.getTime();
    const end = liturgicalYear.dates.nextAdvent1.getTime();
    const t = date.getTime();
    return (t - start) / (end - start);
  }

  function formatDate(date) {
    return date.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  return { computeEaster, sundayOnOrAfter, sundayNearest, sundayCycle, getLiturgicalYear, fractionOfYear, addDays, formatDate, utcDate };
})();

// Lectionary reading data — Sundays and major solemnities/feasts of the
// Roman Catholic Mass Lectionary, Cycles A/B/C.
//
// Citations only (no scripture text) — see README for data-quality notes.
// `anchor` tells liturgical-calendar-resolve.js how to place each entry on
// a real calendar for a given liturgical year.

const LectionaryData = {

  // Fixed/computed feasts and solemnities that aren't part of the
  // Sunday-in-Ordinary-Time or Sunday-in-Lent/Easter sequences.
  solemnities: [
    { id: "christmas", name: "The Nativity of the Lord (Christmas)", rank: "Solemnity", cycle: "ALL", color: "white",
      anchor: { type: "fixed", month: 12, day: 25, yearOffset: -1 },
      readings: { first: "Isaiah 52:7-10", psalm: "Psalm 98:1-6", second: "Hebrews 1:1-6", gospel: "John 1:1-18" } },
    { id: "holy-family-a", name: "The Holy Family", rank: "Feast", cycle: "A", color: "white",
      anchor: { type: "holyFamily" },
      readings: { first: "Sirach 3:2-6,12-14", psalm: "Psalm 128:1-5", second: "Colossians 3:12-21", gospel: "Matthew 2:13-15,19-23" } },
    { id: "holy-family-b", name: "The Holy Family", rank: "Feast", cycle: "B", color: "white",
      anchor: { type: "holyFamily" },
      readings: { first: "Genesis 15:1-6,21:1-3", psalm: "Psalm 105:1-9", second: "Hebrews 11:8,11-12,17-19", gospel: "Luke 2:22-40" } },
    { id: "holy-family-c", name: "The Holy Family", rank: "Feast", cycle: "C", color: "white",
      anchor: { type: "holyFamily" },
      readings: { first: "1 Samuel 1:20-22,24-28", psalm: "Psalm 84:2-3,5-6,9-10", second: "1 John 3:1-2,21-24", gospel: "Luke 2:41-52" } },
    { id: "mary-mother-of-god", name: "Mary, Mother of God", rank: "Solemnity", cycle: "ALL", color: "white",
      anchor: { type: "fixed", month: 1, day: 1, yearOffset: 0 },
      readings: { first: "Numbers 6:22-27", psalm: "Psalm 67:2-3,5-6,8", second: "Galatians 4:4-7", gospel: "Luke 2:16-21" } },
    { id: "epiphany", name: "The Epiphany of the Lord", rank: "Solemnity", cycle: "ALL", color: "white",
      anchor: { type: "computed", key: "epiphany" },
      readings: { first: "Isaiah 60:1-6", psalm: "Psalm 72:1-2,7-8,10-13", second: "Ephesians 3:2-3,5-6", gospel: "Matthew 2:1-12" } },
    { id: "baptism-a", name: "The Baptism of the Lord", rank: "Feast", cycle: "A", color: "white",
      anchor: { type: "computed", key: "baptismOfLord" },
      readings: { first: "Isaiah 42:1-4,6-7", psalm: "Psalm 29:1-4,9-10", second: "Acts 10:34-38", gospel: "Matthew 3:13-17" } },
    { id: "baptism-b", name: "The Baptism of the Lord", rank: "Feast", cycle: "B", color: "white",
      anchor: { type: "computed", key: "baptismOfLord" },
      readings: { first: "Isaiah 42:1-4,6-7", psalm: "Psalm 29:1-4,9-10", second: "Acts 10:34-38", gospel: "Mark 1:7-11" } },
    { id: "baptism-c", name: "The Baptism of the Lord", rank: "Feast", cycle: "C", color: "white",
      anchor: { type: "computed", key: "baptismOfLord" },
      readings: { first: "Isaiah 42:1-4,6-7", psalm: "Psalm 29:1-4,9-10", second: "Acts 10:34-38", gospel: "Luke 3:15-16,21-22" } },

    { id: "ash-wednesday", name: "Ash Wednesday", rank: "", cycle: "ALL", color: "violet",
      anchor: { type: "computed", key: "ashWednesday" },
      readings: { first: "Joel 2:12-18", psalm: "Psalm 51:3-6,12-14,17", second: "2 Corinthians 5:20-6:2", gospel: "Matthew 6:1-6,16-18" } },

    { id: "palm-sunday-a", name: "Palm Sunday of the Passion of the Lord", rank: "", cycle: "A", color: "red",
      anchor: { type: "computed", key: "palmSunday" },
      readings: { first: "Isaiah 50:4-7", psalm: "Psalm 22:8-9,17-20,23-24", second: "Philippians 2:6-11", gospel: "Matthew 26:14-27:66 (Passion)" } },
    { id: "palm-sunday-b", name: "Palm Sunday of the Passion of the Lord", rank: "", cycle: "B", color: "red",
      anchor: { type: "computed", key: "palmSunday" },
      readings: { first: "Isaiah 50:4-7", psalm: "Psalm 22:8-9,17-20,23-24", second: "Philippians 2:6-11", gospel: "Mark 14:1-15:47 (Passion)" } },
    { id: "palm-sunday-c", name: "Palm Sunday of the Passion of the Lord", rank: "", cycle: "C", color: "red",
      anchor: { type: "computed", key: "palmSunday" },
      readings: { first: "Isaiah 50:4-7", psalm: "Psalm 22:8-9,17-20,23-24", second: "Philippians 2:6-11", gospel: "Luke 22:14-23:56 (Passion)" } },

    { id: "holy-thursday", name: "Holy Thursday — Mass of the Lord's Supper", rank: "", cycle: "ALL", color: "white",
      anchor: { type: "computed", key: "holyThursday" },
      readings: { first: "Exodus 12:1-8,11-14", psalm: "Psalm 116:12-13,15-18", second: "1 Corinthians 11:23-26", gospel: "John 13:1-15" } },
    { id: "good-friday", name: "Good Friday — The Passion of the Lord", rank: "", cycle: "ALL", color: "red",
      anchor: { type: "computed", key: "goodFriday" },
      readings: { first: "Isaiah 52:13-53:12", psalm: "Psalm 31:2,6,12-13,15-17,25", second: "Hebrews 4:14-16,5:7-9", gospel: "John 18:1-19:42 (Passion)" } },
    { id: "easter-vigil-a", name: "The Easter Vigil", rank: "", cycle: "A", color: "white",
      anchor: { type: "computed", key: "easterVigil" },
      readings: { first: "Seven OT readings (Genesis 1; Genesis 22; Exodus 14; Isaiah 54; Isaiah 55; Baruch 3; Ezekiel 36)", psalm: "Psalms proper to each reading", second: "Romans 6:3-11", gospel: "Matthew 28:1-10" } },
    { id: "easter-vigil-b", name: "The Easter Vigil", rank: "", cycle: "B", color: "white",
      anchor: { type: "computed", key: "easterVigil" },
      readings: { first: "Seven OT readings (Genesis 1; Genesis 22; Exodus 14; Isaiah 54; Isaiah 55; Baruch 3; Ezekiel 36)", psalm: "Psalms proper to each reading", second: "Romans 6:3-11", gospel: "Mark 16:1-7" } },
    { id: "easter-vigil-c", name: "The Easter Vigil", rank: "", cycle: "C", color: "white",
      anchor: { type: "computed", key: "easterVigil" },
      readings: { first: "Seven OT readings (Genesis 1; Genesis 22; Exodus 14; Isaiah 54; Isaiah 55; Baruch 3; Ezekiel 36)", psalm: "Psalms proper to each reading", second: "Romans 6:3-11", gospel: "Luke 24:1-12" } },

    { id: "easter-sunday", name: "Easter Sunday", rank: "Solemnity", cycle: "ALL", color: "white",
      anchor: { type: "computed", key: "easter" },
      readings: { first: "Acts 10:34a,37-43", psalm: "Psalm 118:1-2,16-17,22-23", second: "Colossians 3:1-4", gospel: "John 20:1-9" } },

    { id: "ascension", name: "The Ascension of the Lord", rank: "Solemnity", cycle: "ALL", color: "white",
      anchor: { type: "computed", key: "ascension" },
      readings: { first: "Acts 1:1-11", psalm: "Psalm 47:2-3,6-9", second: "Ephesians 1:17-23", gospel: { A: "Matthew 28:16-20", B: "Mark 16:15-20", C: "Luke 24:46-53" } } },

    { id: "pentecost", name: "Pentecost Sunday", rank: "Solemnity", cycle: "ALL", color: "red",
      anchor: { type: "computed", key: "pentecost" },
      readings: { first: "Acts 2:1-11", psalm: "Psalm 104:1,24,29-31,34", second: "1 Corinthians 12:3b-7,12-13", gospel: "John 20:19-23" } },

    { id: "trinity-a", name: "The Most Holy Trinity", rank: "Solemnity", cycle: "A", color: "white",
      anchor: { type: "computed", key: "trinitySunday" },
      readings: { first: "Exodus 34:4b-6,8-9", psalm: "Daniel 3:52-56", second: "2 Corinthians 13:11-13", gospel: "John 3:16-18" } },
    { id: "trinity-b", name: "The Most Holy Trinity", rank: "Solemnity", cycle: "B", color: "white",
      anchor: { type: "computed", key: "trinitySunday" },
      readings: { first: "Deuteronomy 4:32-34,39-40", psalm: "Psalm 33:4-6,9,18-20,22", second: "Romans 8:14-17", gospel: "Matthew 28:16-20" } },
    { id: "trinity-c", name: "The Most Holy Trinity", rank: "Solemnity", cycle: "C", color: "white",
      anchor: { type: "computed", key: "trinitySunday" },
      readings: { first: "Proverbs 8:22-31", psalm: "Psalm 8:4-9", second: "Romans 5:1-5", gospel: "John 16:12-15" } },

    { id: "corpus-christi-a", name: "The Most Holy Body and Blood of Christ", rank: "Solemnity", cycle: "A", color: "white",
      anchor: { type: "computed", key: "corpusChristi" },
      readings: { first: "Deuteronomy 8:2-3,14b-16a", psalm: "Psalm 147:12-15,19-20", second: "1 Corinthians 10:16-17", gospel: "John 6:51-58" } },
    { id: "corpus-christi-b", name: "The Most Holy Body and Blood of Christ", rank: "Solemnity", cycle: "B", color: "white",
      anchor: { type: "computed", key: "corpusChristi" },
      readings: { first: "Exodus 24:3-8", psalm: "Psalm 116:12-13,15-18", second: "Hebrews 9:11-15", gospel: "Mark 14:12-16,22-26" } },
    { id: "corpus-christi-c", name: "The Most Holy Body and Blood of Christ", rank: "Solemnity", cycle: "C", color: "white",
      anchor: { type: "computed", key: "corpusChristi" },
      readings: { first: "Genesis 14:18-20", psalm: "Psalm 110:1-4", second: "1 Corinthians 11:23-26", gospel: "Luke 9:11b-17" } },

    { id: "assumption", name: "The Assumption of the Blessed Virgin Mary", rank: "Solemnity", cycle: "ALL", color: "white",
      anchor: { type: "fixed", month: 8, day: 15, yearOffset: 0 },
      readings: { first: "Revelation 11:19a,12:1-6a,10ab", psalm: "Psalm 45:10-12,16", second: "1 Corinthians 15:20-27", gospel: "Luke 1:39-56" } },
    { id: "all-saints", name: "All Saints", rank: "Solemnity", cycle: "ALL", color: "white",
      anchor: { type: "fixed", month: 11, day: 1, yearOffset: 0 },
      readings: { first: "Revelation 7:2-4,9-14", psalm: "Psalm 24:1-6", second: "1 John 3:1-3", gospel: "Matthew 5:1-12a" } },
    { id: "immaculate-conception", name: "The Immaculate Conception", rank: "Solemnity", cycle: "ALL", color: "white",
      anchor: { type: "fixed", month: 12, day: 8, yearOffset: -1 },
      readings: { first: "Genesis 3:9-15,20", psalm: "Psalm 98:1-4", second: "Ephesians 1:3-6,11-12", gospel: "Luke 1:26-38" } },

    { id: "christ-the-king-a", name: "Our Lord Jesus Christ, King of the Universe", rank: "Solemnity", cycle: "A", color: "white",
      anchor: { type: "computed", key: "christTheKing" },
      readings: { first: "Ezekiel 34:11-12,15-17", psalm: "Psalm 23:1-3,5-6", second: "1 Corinthians 15:20-26,28", gospel: "Matthew 25:31-46" } },
    { id: "christ-the-king-b", name: "Our Lord Jesus Christ, King of the Universe", rank: "Solemnity", cycle: "B", color: "white",
      anchor: { type: "computed", key: "christTheKing" },
      readings: { first: "Daniel 7:13-14", psalm: "Psalm 93:1-2,5", second: "Revelation 1:5-8", gospel: "John 18:33-37" } },
    { id: "christ-the-king-c", name: "Our Lord Jesus Christ, King of the Universe", rank: "Solemnity", cycle: "C", color: "white",
      anchor: { type: "computed", key: "christTheKing" },
      readings: { first: "2 Samuel 5:1-3", psalm: "Psalm 122:1-5", second: "Colossians 1:12-20", gospel: "Luke 23:35-43" } }
  ],

  advent: [
    { id: "advent-1a", name: "First Sunday of Advent", cycle: "A", anchor: { type: "advent", n: 1 },
      readings: { first: "Isaiah 2:1-5", psalm: "Psalm 122:1-9", second: "Romans 13:11-14", gospel: "Matthew 24:37-44" } },
    { id: "advent-1b", name: "First Sunday of Advent", cycle: "B", anchor: { type: "advent", n: 1 },
      readings: { first: "Isaiah 63:16b-17,19b,64:2b-7", psalm: "Psalm 80:2-3,15-16,18-19", second: "1 Corinthians 1:3-9", gospel: "Mark 13:33-37" } },
    { id: "advent-1c", name: "First Sunday of Advent", cycle: "C", anchor: { type: "advent", n: 1 },
      readings: { first: "Jeremiah 33:14-16", psalm: "Psalm 25:4-5,8-10,14", second: "1 Thessalonians 3:12-4:2", gospel: "Luke 21:25-28,34-36" } },

    { id: "advent-2a", name: "Second Sunday of Advent", cycle: "A", anchor: { type: "advent", n: 2 },
      readings: { first: "Isaiah 11:1-10", psalm: "Psalm 72:1-2,7-8,12-13,17", second: "Romans 15:4-9", gospel: "Matthew 3:1-12" } },
    { id: "advent-2b", name: "Second Sunday of Advent", cycle: "B", anchor: { type: "advent", n: 2 },
      readings: { first: "Isaiah 40:1-5,9-11", psalm: "Psalm 85:9-14", second: "2 Peter 3:8-14", gospel: "Mark 1:1-8" } },
    { id: "advent-2c", name: "Second Sunday of Advent", cycle: "C", anchor: { type: "advent", n: 2 },
      readings: { first: "Baruch 5:1-9", psalm: "Psalm 126:1-6", second: "Philippians 1:4-6,8-11", gospel: "Luke 3:1-6" } },

    { id: "advent-3a", name: "Third Sunday of Advent", cycle: "A", anchor: { type: "advent", n: 3 },
      readings: { first: "Isaiah 35:1-6a,10", psalm: "Psalm 146:6-10", second: "James 5:7-10", gospel: "Matthew 11:2-11" } },
    { id: "advent-3b", name: "Third Sunday of Advent", cycle: "B", anchor: { type: "advent", n: 3 },
      readings: { first: "Isaiah 61:1-2a,10-11", psalm: "Luke 1:46-50,53-54 (Magnificat)", second: "1 Thessalonians 5:16-24", gospel: "John 1:6-8,19-28" } },
    { id: "advent-3c", name: "Third Sunday of Advent", cycle: "C", anchor: { type: "advent", n: 3 },
      readings: { first: "Zephaniah 3:14-18a", psalm: "Isaiah 12:2-6", second: "Philippians 4:4-7", gospel: "Luke 3:10-18" } },

    { id: "advent-4a", name: "Fourth Sunday of Advent", cycle: "A", anchor: { type: "advent", n: 4 },
      readings: { first: "Isaiah 7:10-14", psalm: "Psalm 24:1-6", second: "Romans 1:1-7", gospel: "Matthew 1:18-24" } },
    { id: "advent-4b", name: "Fourth Sunday of Advent", cycle: "B", anchor: { type: "advent", n: 4 },
      readings: { first: "2 Samuel 7:1-5,8b-12,14a,16", psalm: "Psalm 89:2-5,27,29", second: "Romans 16:25-27", gospel: "Luke 1:26-38" } },
    { id: "advent-4c", name: "Fourth Sunday of Advent", cycle: "C", anchor: { type: "advent", n: 4 },
      readings: { first: "Micah 5:1-4a", psalm: "Psalm 80:2-3,15-16,18-19", second: "Hebrews 10:5-10", gospel: "Luke 1:39-45" } }
  ],

  lent: [
    { id: "lent-1a", name: "First Sunday of Lent", cycle: "A", anchor: { type: "computed", key: "ashWednesday", offsetFrom: "sundayAfter", n: 1 },
      readings: { first: "Genesis 2:7-9,3:1-7", psalm: "Psalm 51:3-6,12-14,17", second: "Romans 5:12-19", gospel: "Matthew 4:1-11" } },
    { id: "lent-1b", name: "First Sunday of Lent", cycle: "B", anchor: { type: "computed", key: "ashWednesday", offsetFrom: "sundayAfter", n: 1 },
      readings: { first: "Genesis 9:8-15", psalm: "Psalm 25:4-9", second: "1 Peter 3:18-22", gospel: "Mark 1:12-15" } },
    { id: "lent-1c", name: "First Sunday of Lent", cycle: "C", anchor: { type: "computed", key: "ashWednesday", offsetFrom: "sundayAfter", n: 1 },
      readings: { first: "Deuteronomy 26:4-10", psalm: "Psalm 91:1-2,10-15", second: "Romans 10:8-13", gospel: "Luke 4:1-13" } },

    { id: "lent-2a", name: "Second Sunday of Lent", cycle: "A", anchor: { type: "computed", key: "ashWednesday", offsetFrom: "sundayAfter", n: 2 },
      readings: { first: "Genesis 12:1-4a", psalm: "Psalm 33:4-5,18-20,22", second: "2 Timothy 1:8b-10", gospel: "Matthew 17:1-9" } },
    { id: "lent-2b", name: "Second Sunday of Lent", cycle: "B", anchor: { type: "computed", key: "ashWednesday", offsetFrom: "sundayAfter", n: 2 },
      readings: { first: "Genesis 22:1-2,9a,10-13,15-18", psalm: "Psalm 116:10,15-19", second: "Romans 8:31b-34", gospel: "Mark 9:2-10" } },
    { id: "lent-2c", name: "Second Sunday of Lent", cycle: "C", anchor: { type: "computed", key: "ashWednesday", offsetFrom: "sundayAfter", n: 2 },
      readings: { first: "Genesis 15:5-12,17-18", psalm: "Psalm 27:1,7-9,13-14", second: "Philippians 3:17-4:1", gospel: "Luke 9:28b-36" } },

    { id: "lent-3a", name: "Third Sunday of Lent", cycle: "A", anchor: { type: "computed", key: "ashWednesday", offsetFrom: "sundayAfter", n: 3 },
      readings: { first: "Exodus 17:3-7", psalm: "Psalm 95:1-2,6-9", second: "Romans 5:1-2,5-8", gospel: "John 4:5-42 (Samaritan woman)" } },
    { id: "lent-3b", name: "Third Sunday of Lent", cycle: "B", anchor: { type: "computed", key: "ashWednesday", offsetFrom: "sundayAfter", n: 3 },
      readings: { first: "Exodus 20:1-17", psalm: "Psalm 19:8-11", second: "1 Corinthians 1:22-25", gospel: "John 2:13-25 (cleansing of the Temple)" } },
    { id: "lent-3c", name: "Third Sunday of Lent", cycle: "C", anchor: { type: "computed", key: "ashWednesday", offsetFrom: "sundayAfter", n: 3 },
      readings: { first: "Exodus 3:1-8a,13-15", psalm: "Psalm 103:1-4,6-8,11", second: "1 Corinthians 10:1-6,10-12", gospel: "Luke 13:1-9" } },

    { id: "lent-4a", name: "Fourth Sunday of Lent (Laetare)", cycle: "A", anchor: { type: "computed", key: "ashWednesday", offsetFrom: "sundayAfter", n: 4 },
      readings: { first: "1 Samuel 16:1b,6-7,10-13a", psalm: "Psalm 23:1-6", second: "Ephesians 5:8-14", gospel: "John 9:1-41 (man born blind)" } },
    { id: "lent-4b", name: "Fourth Sunday of Lent (Laetare)", cycle: "B", anchor: { type: "computed", key: "ashWednesday", offsetFrom: "sundayAfter", n: 4 },
      readings: { first: "2 Chronicles 36:14-16,19-23", psalm: "Psalm 137:1-6", second: "Ephesians 2:4-10", gospel: "John 3:14-21" } },
    { id: "lent-4c", name: "Fourth Sunday of Lent (Laetare)", cycle: "C", anchor: { type: "computed", key: "ashWednesday", offsetFrom: "sundayAfter", n: 4 },
      readings: { first: "Joshua 5:9a,10-12", psalm: "Psalm 34:2-7", second: "2 Corinthians 5:17-21", gospel: "Luke 15:1-3,11-32 (Prodigal Son)" } },

    { id: "lent-5a", name: "Fifth Sunday of Lent", cycle: "A", anchor: { type: "computed", key: "ashWednesday", offsetFrom: "sundayAfter", n: 5 },
      readings: { first: "Ezekiel 37:12-14", psalm: "Psalm 130:1-8", second: "Romans 8:8-11", gospel: "John 11:1-45 (raising of Lazarus)" } },
    { id: "lent-5b", name: "Fifth Sunday of Lent", cycle: "B", anchor: { type: "computed", key: "ashWednesday", offsetFrom: "sundayAfter", n: 5 },
      readings: { first: "Jeremiah 31:31-34", psalm: "Psalm 51:3-4,12-15", second: "Hebrews 5:7-9", gospel: "John 12:20-33" } },
    { id: "lent-5c", name: "Fifth Sunday of Lent", cycle: "C", anchor: { type: "computed", key: "ashWednesday", offsetFrom: "sundayAfter", n: 5 },
      readings: { first: "Isaiah 43:16-21", psalm: "Psalm 126:1-6", second: "Philippians 3:8-14", gospel: "John 8:1-11 (woman caught in adultery)" } }
  ],

  easter: [
    { id: "easter-2", name: "Second Sunday of Easter (Divine Mercy Sunday)", cycle: "A", anchor: { type: "easterOffset", days: 7 },
      readings: { first: "Acts 2:42-47", psalm: "Psalm 118:2-4,13-15,22-24", second: "1 Peter 1:3-9", gospel: "John 20:19-31" } },
    { id: "easter-2b", name: "Second Sunday of Easter (Divine Mercy Sunday)", cycle: "B", anchor: { type: "easterOffset", days: 7 },
      readings: { first: "Acts 4:32-35", psalm: "Psalm 118:2-4,13-15,22-24", second: "1 John 5:1-6", gospel: "John 20:19-31" } },
    { id: "easter-2c", name: "Second Sunday of Easter (Divine Mercy Sunday)", cycle: "C", anchor: { type: "easterOffset", days: 7 },
      readings: { first: "Acts 5:12-16", psalm: "Psalm 118:2-4,13-15,22-24", second: "Revelation 1:9-11a,12-13,17-19", gospel: "John 20:19-31" } },

    { id: "easter-3a", name: "Third Sunday of Easter", cycle: "A", anchor: { type: "easterOffset", days: 14 },
      readings: { first: "Acts 2:14,22-33", psalm: "Psalm 16:1-2,5,7-11", second: "1 Peter 1:17-21", gospel: "Luke 24:13-35 (Road to Emmaus)" } },
    { id: "easter-3b", name: "Third Sunday of Easter", cycle: "B", anchor: { type: "easterOffset", days: 14 },
      readings: { first: "Acts 3:13-15,17-19", psalm: "Psalm 4:2,4,7-9", second: "1 John 2:1-5a", gospel: "Luke 24:35-48" } },
    { id: "easter-3c", name: "Third Sunday of Easter", cycle: "C", anchor: { type: "easterOffset", days: 14 },
      readings: { first: "Acts 5:27-32,40b-41", psalm: "Psalm 30:2,4-6,11-13", second: "Revelation 5:11-14", gospel: "John 21:1-19 (Feed my sheep)" } },

    { id: "easter-4a", name: "Fourth Sunday of Easter (Good Shepherd Sunday)", cycle: "A", anchor: { type: "easterOffset", days: 21 },
      readings: { first: "Acts 2:14a,36-41", psalm: "Psalm 23:1-6", second: "1 Peter 2:20b-25", gospel: "John 10:1-10" } },
    { id: "easter-4b", name: "Fourth Sunday of Easter (Good Shepherd Sunday)", cycle: "B", anchor: { type: "easterOffset", days: 21 },
      readings: { first: "Acts 4:8-12", psalm: "Psalm 118:1,8-9,21-23,26,28-29", second: "1 John 3:1-2", gospel: "John 10:11-18" } },
    { id: "easter-4c", name: "Fourth Sunday of Easter (Good Shepherd Sunday)", cycle: "C", anchor: { type: "easterOffset", days: 21 },
      readings: { first: "Acts 13:14,43-52", psalm: "Psalm 100:1-3,5", second: "Revelation 7:9,14b-17", gospel: "John 10:27-30" } },

    { id: "easter-5a", name: "Fifth Sunday of Easter", cycle: "A", anchor: { type: "easterOffset", days: 28 },
      readings: { first: "Acts 6:1-7", psalm: "Psalm 33:1-2,4-5,18-19", second: "1 Peter 2:4-9", gospel: "John 14:1-12" } },
    { id: "easter-5b", name: "Fifth Sunday of Easter", cycle: "B", anchor: { type: "easterOffset", days: 28 },
      readings: { first: "Acts 9:26-31", psalm: "Psalm 22:26-28,30-32", second: "1 John 3:18-24", gospel: "John 15:1-8 (True Vine)" } },
    { id: "easter-5c", name: "Fifth Sunday of Easter", cycle: "C", anchor: { type: "easterOffset", days: 28 },
      readings: { first: "Acts 14:21-27", psalm: "Psalm 145:8-13", second: "Revelation 21:1-5a", gospel: "John 13:31-33a,34-35 (New Commandment)" } },

    { id: "easter-6a", name: "Sixth Sunday of Easter", cycle: "A", anchor: { type: "easterOffset", days: 35 },
      readings: { first: "Acts 8:5-8,14-17", psalm: "Psalm 66:1-7,16,20", second: "1 Peter 3:15-18", gospel: "John 14:15-21" } },
    { id: "easter-6b", name: "Sixth Sunday of Easter", cycle: "B", anchor: { type: "easterOffset", days: 35 },
      readings: { first: "Acts 10:25-26,34-35,44-48", psalm: "Psalm 98:1-4", second: "1 John 4:7-10", gospel: "John 15:9-17" } },
    { id: "easter-6c", name: "Sixth Sunday of Easter", cycle: "C", anchor: { type: "easterOffset", days: 35 },
      readings: { first: "Acts 15:1-2,22-29", psalm: "Psalm 67:2-3,5-6,8", second: "Revelation 21:10-14,22-23", gospel: "John 14:23-29" } },

    { id: "easter-7a", name: "Seventh Sunday of Easter", cycle: "A", anchor: { type: "easterOffset", days: 42 },
      readings: { first: "Acts 1:12-14", psalm: "Psalm 27:1,4,7-8", second: "1 Peter 4:13-16", gospel: "John 17:1-11a" } },
    { id: "easter-7b", name: "Seventh Sunday of Easter", cycle: "B", anchor: { type: "easterOffset", days: 42 },
      readings: { first: "Acts 1:15-17,20a,20c-26", psalm: "Psalm 103:1-2,11-12,19-20", second: "1 John 4:11-16", gospel: "John 17:11b-19" } },
    { id: "easter-7c", name: "Seventh Sunday of Easter", cycle: "C", anchor: { type: "easterOffset", days: 42 },
      readings: { first: "Acts 7:55-60", psalm: "Psalm 97:1-2,6-7,9", second: "Revelation 22:12-14,16-17,20", gospel: "John 17:20-26" } }
  ],

  // Sundays in Ordinary Time, weeks 2-33 (week 1 = Baptism of the Lord;
  // week 34 = Christ the King, both listed under `solemnities`).
  // `half` says whether the week normally falls before Lent ("first") or
  // after Pentecost ("second") — the app positions these by counting actual
  // Sundays in each block for the chosen year, matching the Roman Calendar's
  // own rule of using consecutive numbers at each end and skipping the middle.
  ot: [
    // Year A
    { id: "ot-2a", week: 2, half: "first", cycle: "A", name: "Second Sunday in Ordinary Time",
      readings: { first: "Isaiah 49:3,5-6", psalm: "Psalm 40:2,4,7-10", second: "1 Corinthians 1:1-3", gospel: "John 1:29-34" } },
    { id: "ot-3a", week: 3, half: "first", cycle: "A", name: "Third Sunday in Ordinary Time",
      readings: { first: "Isaiah 8:23-9:3", psalm: "Psalm 27:1,4,13-14", second: "1 Corinthians 1:10-13,17", gospel: "Matthew 4:12-23" } },
    { id: "ot-4a", week: 4, half: "first", cycle: "A", name: "Fourth Sunday in Ordinary Time",
      readings: { first: "Zephaniah 2:3,3:12-13", psalm: "Psalm 146:6-10", second: "1 Corinthians 1:26-31", gospel: "Matthew 5:1-12a (Beatitudes)" } },
    { id: "ot-5a", week: 5, half: "first", cycle: "A", name: "Fifth Sunday in Ordinary Time",
      readings: { first: "Isaiah 58:7-10", psalm: "Psalm 112:4-9", second: "1 Corinthians 2:1-5", gospel: "Matthew 5:13-16 (Salt and Light)" } },
    { id: "ot-6a", week: 6, half: "first", cycle: "A", name: "Sixth Sunday in Ordinary Time",
      readings: { first: "Sirach 15:15-20", psalm: "Psalm 119:1-2,4-5,17-18,33-34", second: "1 Corinthians 2:6-10", gospel: "Matthew 5:17-37" } },
    { id: "ot-7a", week: 7, half: "first", cycle: "A", name: "Seventh Sunday in Ordinary Time",
      readings: { first: "Leviticus 19:1-2,17-18", psalm: "Psalm 103:1-4,8,10,12-13", second: "1 Corinthians 3:16-23", gospel: "Matthew 5:38-48" } },
    { id: "ot-8a", week: 8, half: "first", cycle: "A", name: "Eighth Sunday in Ordinary Time",
      readings: { first: "Isaiah 49:14-15", psalm: "Psalm 62:2-3,6-9", second: "1 Corinthians 4:1-5", gospel: "Matthew 6:24-34" } },
    { id: "ot-9a", week: 9, half: "first", cycle: "A", name: "Ninth Sunday in Ordinary Time",
      readings: { first: "Deuteronomy 11:18,26-28,32", psalm: "Psalm 31:2-4,17,25", second: "Romans 3:21-25,28", gospel: "Matthew 7:21-27" } },
    { id: "ot-10a", week: 10, half: "second", cycle: "A", name: "Tenth Sunday in Ordinary Time",
      readings: { first: "Hosea 6:3-6", psalm: "Psalm 50:1,8,12-15", second: "Romans 4:18-25", gospel: "Matthew 9:9-13 (Call of Matthew)" } },
    { id: "ot-11a", week: 11, half: "second", cycle: "A", name: "Eleventh Sunday in Ordinary Time",
      readings: { first: "Exodus 19:2-6a", psalm: "Psalm 100:1-3,5", second: "Romans 5:6-11", gospel: "Matthew 9:36-10:8" } },
    { id: "ot-12a", week: 12, half: "second", cycle: "A", name: "Twelfth Sunday in Ordinary Time",
      readings: { first: "Jeremiah 20:10-13", psalm: "Psalm 69:8-10,14,17,33-35", second: "Romans 5:12-15", gospel: "Matthew 10:26-33" } },
    { id: "ot-13a", week: 13, half: "second", cycle: "A", name: "Thirteenth Sunday in Ordinary Time",
      readings: { first: "2 Kings 4:8-11,14-16a", psalm: "Psalm 89:2-3,16-19", second: "Romans 6:3-4,8-11", gospel: "Matthew 10:37-42" } },
    { id: "ot-14a", week: 14, half: "second", cycle: "A", name: "Fourteenth Sunday in Ordinary Time",
      readings: { first: "Zechariah 9:9-10", psalm: "Psalm 145:1-2,8-11,13-14", second: "Romans 8:9,11-13", gospel: "Matthew 11:25-30" } },
    { id: "ot-15a", week: 15, half: "second", cycle: "A", name: "Fifteenth Sunday in Ordinary Time",
      readings: { first: "Isaiah 55:10-11", psalm: "Psalm 65:10-14", second: "Romans 8:18-23", gospel: "Matthew 13:1-23 (Parable of the Sower)" } },
    { id: "ot-16a", week: 16, half: "second", cycle: "A", name: "Sixteenth Sunday in Ordinary Time",
      readings: { first: "Wisdom 12:13,16-19", psalm: "Psalm 86:5-6,9-10,15-16", second: "Romans 8:26-27", gospel: "Matthew 13:24-43 (Weeds among the Wheat)" } },
    { id: "ot-17a", week: 17, half: "second", cycle: "A", name: "Seventeenth Sunday in Ordinary Time",
      readings: { first: "1 Kings 3:5,7-12", psalm: "Psalm 119:57,72,76-77,127-130", second: "Romans 8:28-30", gospel: "Matthew 13:44-52 (Treasure and Pearl)" } },
    { id: "ot-18a", week: 18, half: "second", cycle: "A", name: "Eighteenth Sunday in Ordinary Time",
      readings: { first: "Isaiah 55:1-3", psalm: "Psalm 145:8-9,15-18", second: "Romans 8:35,37-39", gospel: "Matthew 14:13-21 (Loaves and Fishes)" } },
    { id: "ot-19a", week: 19, half: "second", cycle: "A", name: "Nineteenth Sunday in Ordinary Time",
      readings: { first: "1 Kings 19:9a,11-13a", psalm: "Psalm 85:9-14", second: "Romans 9:1-5", gospel: "Matthew 14:22-33 (Walking on Water)" } },
    { id: "ot-20a", week: 20, half: "second", cycle: "A", name: "Twentieth Sunday in Ordinary Time",
      readings: { first: "Isaiah 56:1,6-7", psalm: "Psalm 67:2-3,5-6,8", second: "Romans 11:13-15,29-32", gospel: "Matthew 15:21-28 (Canaanite Woman)" } },
    { id: "ot-21a", week: 21, half: "second", cycle: "A", name: "Twenty-First Sunday in Ordinary Time",
      readings: { first: "Isaiah 22:19-23", psalm: "Psalm 138:1-3,6,8", second: "Romans 11:33-36", gospel: "Matthew 16:13-20 (Peter's Confession)" } },
    { id: "ot-22a", week: 22, half: "second", cycle: "A", name: "Twenty-Second Sunday in Ordinary Time",
      readings: { first: "Jeremiah 20:7-9", psalm: "Psalm 63:2-6,8-9", second: "Romans 12:1-2", gospel: "Matthew 16:21-27" } },
    { id: "ot-23a", week: 23, half: "second", cycle: "A", name: "Twenty-Third Sunday in Ordinary Time",
      readings: { first: "Ezekiel 33:7-9", psalm: "Psalm 95:1-2,6-9", second: "Romans 13:8-10", gospel: "Matthew 18:15-20 (Fraternal Correction)" } },
    { id: "ot-24a", week: 24, half: "second", cycle: "A", name: "Twenty-Fourth Sunday in Ordinary Time",
      readings: { first: "Sirach 27:30-28:7", psalm: "Psalm 103:1-4,9-12", second: "Romans 14:7-9", gospel: "Matthew 18:21-35 (Unforgiving Servant)" } },
    { id: "ot-25a", week: 25, half: "second", cycle: "A", name: "Twenty-Fifth Sunday in Ordinary Time",
      readings: { first: "Isaiah 55:6-9", psalm: "Psalm 145:2-3,8-9,17-18", second: "Philippians 1:20c-24,27a", gospel: "Matthew 20:1-16a (Workers in the Vineyard)" } },
    { id: "ot-26a", week: 26, half: "second", cycle: "A", name: "Twenty-Sixth Sunday in Ordinary Time",
      readings: { first: "Ezekiel 18:25-28", psalm: "Psalm 25:4-9", second: "Philippians 2:1-11", gospel: "Matthew 21:28-32 (Two Sons)" } },
    { id: "ot-27a", week: 27, half: "second", cycle: "A", name: "Twenty-Seventh Sunday in Ordinary Time",
      readings: { first: "Isaiah 5:1-7", psalm: "Psalm 80:9,12-16,19-20", second: "Philippians 4:6-9", gospel: "Matthew 21:33-43 (Wicked Tenants)" } },
    { id: "ot-28a", week: 28, half: "second", cycle: "A", name: "Twenty-Eighth Sunday in Ordinary Time",
      readings: { first: "Isaiah 25:6-10a", psalm: "Psalm 23:1-6", second: "Philippians 4:12-14,19-20", gospel: "Matthew 22:1-14 (Wedding Feast)" } },
    { id: "ot-29a", week: 29, half: "second", cycle: "A", name: "Twenty-Ninth Sunday in Ordinary Time",
      readings: { first: "Isaiah 45:1,4-6", psalm: "Psalm 96:1,3-5,7-10", second: "1 Thessalonians 1:1-5b", gospel: "Matthew 22:15-21 (Render unto Caesar)" } },
    { id: "ot-30a", week: 30, half: "second", cycle: "A", name: "Thirtieth Sunday in Ordinary Time",
      readings: { first: "Exodus 22:20-26", psalm: "Psalm 18:2-4,47,51", second: "1 Thessalonians 1:5c-10", gospel: "Matthew 22:34-40 (Greatest Commandment)" } },
    { id: "ot-31a", week: 31, half: "second", cycle: "A", name: "Thirty-First Sunday in Ordinary Time",
      readings: { first: "Malachi 1:14b-2:2b,8-10", psalm: "Psalm 131:1-3", second: "1 Thessalonians 2:7b-9,13", gospel: "Matthew 23:1-12" } },
    { id: "ot-32a", week: 32, half: "second", cycle: "A", name: "Thirty-Second Sunday in Ordinary Time",
      readings: { first: "Wisdom 6:12-16", psalm: "Psalm 63:2-8", second: "1 Thessalonians 4:13-18", gospel: "Matthew 25:1-13 (Wise and Foolish Virgins)" } },
    { id: "ot-33a", week: 33, half: "second", cycle: "A", name: "Thirty-Third Sunday in Ordinary Time",
      readings: { first: "Proverbs 31:10-13,19-20,30-31", psalm: "Psalm 128:1-5", second: "1 Thessalonians 5:1-6", gospel: "Matthew 25:14-30 (Parable of the Talents)" } },

    // Year B
    { id: "ot-2b", week: 2, half: "first", cycle: "B", name: "Second Sunday in Ordinary Time",
      readings: { first: "1 Samuel 3:3b-10,19", psalm: "Psalm 40:2,4,7-10", second: "1 Corinthians 6:13c-15a,17-20", gospel: "John 1:35-42 (Call of the First Disciples)" } },
    { id: "ot-3b", week: 3, half: "first", cycle: "B", name: "Third Sunday in Ordinary Time",
      readings: { first: "Jonah 3:1-5,10", psalm: "Psalm 25:4-9", second: "1 Corinthians 7:29-31", gospel: "Mark 1:14-20" } },
    { id: "ot-4b", week: 4, half: "first", cycle: "B", name: "Fourth Sunday in Ordinary Time",
      readings: { first: "Deuteronomy 18:15-20", psalm: "Psalm 95:1-2,6-9", second: "1 Corinthians 7:32-35", gospel: "Mark 1:21-28" } },
    { id: "ot-5b", week: 5, half: "first", cycle: "B", name: "Fifth Sunday in Ordinary Time",
      readings: { first: "Job 7:1-4,6-7", psalm: "Psalm 147:1-6", second: "1 Corinthians 9:16-19,22-23", gospel: "Mark 1:29-39" } },
    { id: "ot-6b", week: 6, half: "first", cycle: "B", name: "Sixth Sunday in Ordinary Time",
      readings: { first: "Leviticus 13:1-2,44-46", psalm: "Psalm 32:1-2,5,11", second: "1 Corinthians 10:31-11:1", gospel: "Mark 1:40-45 (Cleansing of a Leper)" } },
    { id: "ot-7b", week: 7, half: "first", cycle: "B", name: "Seventh Sunday in Ordinary Time",
      readings: { first: "Isaiah 43:18-19,21-22,24b-25", psalm: "Psalm 41:2-5,13-14", second: "2 Corinthians 1:18-22", gospel: "Mark 2:1-12 (Healing of the Paralytic)" } },
    { id: "ot-8b", week: 8, half: "first", cycle: "B", name: "Eighth Sunday in Ordinary Time",
      readings: { first: "Hosea 2:16b,17b,21-22", psalm: "Psalm 103:1-4,8,10,12-13", second: "2 Corinthians 3:1b-6", gospel: "Mark 2:18-22 (New Wine, New Wineskins)" } },
    { id: "ot-9b", week: 9, half: "first", cycle: "B", name: "Ninth Sunday in Ordinary Time",
      readings: { first: "Deuteronomy 5:12-15", psalm: "Psalm 81:3-8,10-11", second: "2 Corinthians 4:6-11", gospel: "Mark 2:23-3:6 (Lord of the Sabbath)" } },
    { id: "ot-10b", week: 10, half: "second", cycle: "B", name: "Tenth Sunday in Ordinary Time",
      readings: { first: "Genesis 3:9-15", psalm: "Psalm 130:1-8", second: "2 Corinthians 4:13-5:1", gospel: "Mark 3:20-35 (Beelzebul Controversy)" } },
    { id: "ot-11b", week: 11, half: "second", cycle: "B", name: "Eleventh Sunday in Ordinary Time",
      readings: { first: "Ezekiel 17:22-24", psalm: "Psalm 92:2-3,13-16", second: "2 Corinthians 5:6-10", gospel: "Mark 4:26-34 (Mustard Seed)" } },
    { id: "ot-12b", week: 12, half: "second", cycle: "B", name: "Twelfth Sunday in Ordinary Time",
      readings: { first: "Job 38:1,8-11", psalm: "Psalm 107:23-26,28-31", second: "2 Corinthians 5:14-17", gospel: "Mark 4:35-41 (Calming of the Storm)" } },
    { id: "ot-13b", week: 13, half: "second", cycle: "B", name: "Thirteenth Sunday in Ordinary Time",
      readings: { first: "Wisdom 1:13-15,2:23-24", psalm: "Psalm 30:2,4-6,11-13", second: "2 Corinthians 8:7,9,13-15", gospel: "Mark 5:21-43 (Jairus' Daughter)" } },
    { id: "ot-14b", week: 14, half: "second", cycle: "B", name: "Fourteenth Sunday in Ordinary Time",
      readings: { first: "Ezekiel 2:2-5", psalm: "Psalm 123:1-4", second: "2 Corinthians 12:7-10", gospel: "Mark 6:1-6 (Rejection at Nazareth)" } },
    { id: "ot-15b", week: 15, half: "second", cycle: "B", name: "Fifteenth Sunday in Ordinary Time",
      readings: { first: "Amos 7:12-15", psalm: "Psalm 85:9-14", second: "Ephesians 1:3-14", gospel: "Mark 6:7-13 (Sending of the Twelve)" } },
    { id: "ot-16b", week: 16, half: "second", cycle: "B", name: "Sixteenth Sunday in Ordinary Time",
      readings: { first: "Jeremiah 23:1-6", psalm: "Psalm 23:1-6", second: "Ephesians 2:13-18", gospel: "Mark 6:30-34 (Rest Awhile)" } },
    { id: "ot-17b", week: 17, half: "second", cycle: "B", name: "Seventeenth Sunday in Ordinary Time",
      readings: { first: "2 Kings 4:42-44", psalm: "Psalm 145:10-11,15-18", second: "Ephesians 4:1-6", gospel: "John 6:1-15 (Multiplication of Loaves)" } },
    { id: "ot-18b", week: 18, half: "second", cycle: "B", name: "Eighteenth Sunday in Ordinary Time",
      readings: { first: "Exodus 16:2-4,12-15", psalm: "Psalm 78:3-4,23-25,54", second: "Ephesians 4:17,20-24", gospel: "John 6:24-35 (Bread of Life I)" } },
    { id: "ot-19b", week: 19, half: "second", cycle: "B", name: "Nineteenth Sunday in Ordinary Time",
      readings: { first: "1 Kings 19:4-8", psalm: "Psalm 34:2-9", second: "Ephesians 4:30-5:2", gospel: "John 6:41-51 (Bread of Life II)" } },
    { id: "ot-20b", week: 20, half: "second", cycle: "B", name: "Twentieth Sunday in Ordinary Time",
      readings: { first: "Proverbs 9:1-6", psalm: "Psalm 34:2-7", second: "Ephesians 5:15-20", gospel: "John 6:51-58 (Bread of Life III)" } },
    { id: "ot-21b", week: 21, half: "second", cycle: "B", name: "Twenty-First Sunday in Ordinary Time",
      readings: { first: "Joshua 24:1-2a,15-17,18b", psalm: "Psalm 34:2-3,16-21", second: "Ephesians 5:21-32", gospel: "John 6:60-69 (Bread of Life IV)" } },
    { id: "ot-22b", week: 22, half: "second", cycle: "B", name: "Twenty-Second Sunday in Ordinary Time",
      readings: { first: "Deuteronomy 4:1-2,6-8", psalm: "Psalm 15:2-5", second: "James 1:17-18,21b-22,27", gospel: "Mark 7:1-8,14-15,21-23 (Traditions of the Elders)" } },
    { id: "ot-23b", week: 23, half: "second", cycle: "B", name: "Twenty-Third Sunday in Ordinary Time",
      readings: { first: "Isaiah 35:4-7a", psalm: "Psalm 146:6-10", second: "James 2:1-5", gospel: "Mark 7:31-37 (Ephphatha)" } },
    { id: "ot-24b", week: 24, half: "second", cycle: "B", name: "Twenty-Fourth Sunday in Ordinary Time",
      readings: { first: "Isaiah 50:5-9a", psalm: "Psalm 116:1-6,8-9", second: "James 2:14-18", gospel: "Mark 8:27-35 (Peter's Confession)" } },
    { id: "ot-25b", week: 25, half: "second", cycle: "B", name: "Twenty-Fifth Sunday in Ordinary Time",
      readings: { first: "Wisdom 2:12,17-20", psalm: "Psalm 54:3-8", second: "James 3:16-4:3", gospel: "Mark 9:30-37 (The Greatest is the Servant)" } },
    { id: "ot-26b", week: 26, half: "second", cycle: "B", name: "Twenty-Sixth Sunday in Ordinary Time",
      readings: { first: "Numbers 11:25-29", psalm: "Psalm 19:8,10,12-14", second: "James 5:1-6", gospel: "Mark 9:38-43,45,47-48" } },
    { id: "ot-27b", week: 27, half: "second", cycle: "B", name: "Twenty-Seventh Sunday in Ordinary Time",
      readings: { first: "Genesis 2:18-24", psalm: "Psalm 128:1-6", second: "Hebrews 2:9-11", gospel: "Mark 10:2-16 (Marriage and Divorce)" } },
    { id: "ot-28b", week: 28, half: "second", cycle: "B", name: "Twenty-Eighth Sunday in Ordinary Time",
      readings: { first: "Wisdom 7:7-11", psalm: "Psalm 90:12-17", second: "Hebrews 4:12-13", gospel: "Mark 10:17-30 (The Rich Young Man)" } },
    { id: "ot-29b", week: 29, half: "second", cycle: "B", name: "Twenty-Ninth Sunday in Ordinary Time",
      readings: { first: "Isaiah 53:10-11", psalm: "Psalm 33:4-5,18-20,22", second: "Hebrews 4:14-16", gospel: "Mark 10:35-45 (Request of James and John)" } },
    { id: "ot-30b", week: 30, half: "second", cycle: "B", name: "Thirtieth Sunday in Ordinary Time",
      readings: { first: "Jeremiah 31:7-9", psalm: "Psalm 126:1-6", second: "Hebrews 5:1-6", gospel: "Mark 10:46-52 (Blind Bartimaeus)" } },
    { id: "ot-31b", week: 31, half: "second", cycle: "B", name: "Thirty-First Sunday in Ordinary Time",
      readings: { first: "Deuteronomy 6:2-6", psalm: "Psalm 18:2-4,47,51", second: "Hebrews 7:23-28", gospel: "Mark 12:28-34 (Greatest Commandment)" } },
    { id: "ot-32b", week: 32, half: "second", cycle: "B", name: "Thirty-Second Sunday in Ordinary Time",
      readings: { first: "1 Kings 17:10-16", psalm: "Psalm 146:6-10", second: "Hebrews 9:24-28", gospel: "Mark 12:38-44 (Widow's Mite)" } },
    { id: "ot-33b", week: 33, half: "second", cycle: "B", name: "Thirty-Third Sunday in Ordinary Time",
      readings: { first: "Daniel 12:1-3", psalm: "Psalm 16:5,8-11", second: "Hebrews 10:11-14,18", gospel: "Mark 13:24-32 (End Times)" } },

    // Year C
    { id: "ot-2c", week: 2, half: "first", cycle: "C", name: "Second Sunday in Ordinary Time",
      readings: { first: "Isaiah 62:1-5", psalm: "Psalm 96:1-3,7-10", second: "1 Corinthians 12:4-11", gospel: "John 2:1-11 (Wedding at Cana)" } },
    { id: "ot-3c", week: 3, half: "first", cycle: "C", name: "Third Sunday in Ordinary Time",
      readings: { first: "Nehemiah 8:2-4a,5-6,8-10", psalm: "Psalm 19:8-10,15", second: "1 Corinthians 12:12-30", gospel: "Luke 1:1-4,4:14-21" } },
    { id: "ot-4c", week: 4, half: "first", cycle: "C", name: "Fourth Sunday in Ordinary Time",
      readings: { first: "Jeremiah 1:4-5,17-19", psalm: "Psalm 71:1-6,15-17", second: "1 Corinthians 12:31-13:13", gospel: "Luke 4:21-30 (Rejection at Nazareth)" } },
    { id: "ot-5c", week: 5, half: "first", cycle: "C", name: "Fifth Sunday in Ordinary Time",
      readings: { first: "Isaiah 6:1-2a,3-8", psalm: "Psalm 138:1-5,7-8", second: "1 Corinthians 15:1-11", gospel: "Luke 5:1-11 (Miraculous Catch of Fish)" } },
    { id: "ot-6c", week: 6, half: "first", cycle: "C", name: "Sixth Sunday in Ordinary Time",
      readings: { first: "Jeremiah 17:5-8", psalm: "Psalm 1:1-4,6", second: "1 Corinthians 15:12,16-20", gospel: "Luke 6:17,20-26 (Beatitudes and Woes)" } },
    { id: "ot-7c", week: 7, half: "first", cycle: "C", name: "Seventh Sunday in Ordinary Time",
      readings: { first: "1 Samuel 26:2,7-9,12-13,22-23", psalm: "Psalm 103:1-4,8,10,12-13", second: "1 Corinthians 15:45-49", gospel: "Luke 6:27-38 (Love of Enemies)" } },
    { id: "ot-8c", week: 8, half: "first", cycle: "C", name: "Eighth Sunday in Ordinary Time",
      readings: { first: "Sirach 27:4-7", psalm: "Psalm 92:2-3,13-16", second: "1 Corinthians 15:54-58", gospel: "Luke 6:39-45 (Blind Leading the Blind)" } },
    { id: "ot-9c", week: 9, half: "first", cycle: "C", name: "Ninth Sunday in Ordinary Time",
      readings: { first: "1 Kings 8:41-43", psalm: "Psalm 117:1-2", second: "Galatians 1:1-2,6-10", gospel: "Luke 7:1-10 (Centurion's Servant)" } },
    { id: "ot-10c", week: 10, half: "second", cycle: "C", name: "Tenth Sunday in Ordinary Time",
      readings: { first: "1 Kings 17:17-24", psalm: "Psalm 30:2,4-6,11-13", second: "Galatians 1:11-19", gospel: "Luke 7:11-17 (Widow's Son at Nain)" } },
    { id: "ot-11c", week: 11, half: "second", cycle: "C", name: "Eleventh Sunday in Ordinary Time",
      readings: { first: "2 Samuel 12:7-10,13", psalm: "Psalm 32:1-2,5,7,11", second: "Galatians 2:16,19-21", gospel: "Luke 7:36-8:3 (Sinful Woman Forgiven)" } },
    { id: "ot-12c", week: 12, half: "second", cycle: "C", name: "Twelfth Sunday in Ordinary Time",
      readings: { first: "Zechariah 12:10-11", psalm: "Psalm 63:2-6,8-9", second: "Galatians 3:26-29", gospel: "Luke 9:18-24 (Peter's Confession)" } },
    { id: "ot-13c", week: 13, half: "second", cycle: "C", name: "Thirteenth Sunday in Ordinary Time",
      readings: { first: "1 Kings 19:16b,19-21", psalm: "Psalm 16:1-2,5,7-11", second: "Galatians 5:1,13-18", gospel: "Luke 9:51-62 (Resolute for Jerusalem)" } },
    { id: "ot-14c", week: 14, half: "second", cycle: "C", name: "Fourteenth Sunday in Ordinary Time",
      readings: { first: "Isaiah 66:10-14c", psalm: "Psalm 66:1-7,16,20", second: "Galatians 6:14-18", gospel: "Luke 10:1-12,17-20 (Sending of the Seventy-two)" } },
    { id: "ot-15c", week: 15, half: "second", cycle: "C", name: "Fifteenth Sunday in Ordinary Time",
      readings: { first: "Deuteronomy 30:10-14", psalm: "Psalm 69:14,17,30-31,33-34,36-37", second: "Colossians 1:15-20", gospel: "Luke 10:25-37 (The Good Samaritan)" } },
    { id: "ot-16c", week: 16, half: "second", cycle: "C", name: "Sixteenth Sunday in Ordinary Time",
      readings: { first: "Genesis 18:1-10a", psalm: "Psalm 15:2-5", second: "Colossians 1:24-28", gospel: "Luke 10:38-42 (Martha and Mary)" } },
    { id: "ot-17c", week: 17, half: "second", cycle: "C", name: "Seventeenth Sunday in Ordinary Time",
      readings: { first: "Genesis 18:20-32", psalm: "Psalm 138:1-3,6-8", second: "Colossians 2:12-14", gospel: "Luke 11:1-13 (The Lord's Prayer)" } },
    { id: "ot-18c", week: 18, half: "second", cycle: "C", name: "Eighteenth Sunday in Ordinary Time",
      readings: { first: "Ecclesiastes 1:2,2:21-23", psalm: "Psalm 90:3-6,12-14,17", second: "Colossians 3:1-5,9-11", gospel: "Luke 12:13-21 (Parable of the Rich Fool)" } },
    { id: "ot-19c", week: 19, half: "second", cycle: "C", name: "Nineteenth Sunday in Ordinary Time",
      readings: { first: "Wisdom 18:6-9", psalm: "Psalm 33:1,12,18-22", second: "Hebrews 11:1-2,8-19", gospel: "Luke 12:32-48 (Be Watchful)" } },
    { id: "ot-20c", week: 20, half: "second", cycle: "C", name: "Twentieth Sunday in Ordinary Time",
      readings: { first: "Jeremiah 38:4-6,8-10", psalm: "Psalm 40:2-4,18", second: "Hebrews 12:1-4", gospel: "Luke 12:49-53 (Not Peace but Division)" } },
    { id: "ot-21c", week: 21, half: "second", cycle: "C", name: "Twenty-First Sunday in Ordinary Time",
      readings: { first: "Isaiah 66:18-21", psalm: "Psalm 117:1-2", second: "Hebrews 12:5-7,11-13", gospel: "Luke 13:22-30 (The Narrow Gate)" } },
    { id: "ot-22c", week: 22, half: "second", cycle: "C", name: "Twenty-Second Sunday in Ordinary Time",
      readings: { first: "Sirach 3:17-18,20,28-29", psalm: "Psalm 68:4-7,10-11", second: "Hebrews 12:18-19,22-24a", gospel: "Luke 14:1,7-14 (Humility at Table)" } },
    { id: "ot-23c", week: 23, half: "second", cycle: "C", name: "Twenty-Third Sunday in Ordinary Time",
      readings: { first: "Wisdom 9:13-18b", psalm: "Psalm 90:3-6,12-17", second: "Philemon 9-10,12-17", gospel: "Luke 14:25-33 (Cost of Discipleship)" } },
    { id: "ot-24c", week: 24, half: "second", cycle: "C", name: "Twenty-Fourth Sunday in Ordinary Time",
      readings: { first: "Exodus 32:7-11,13-14", psalm: "Psalm 51:3-4,12-13,17,19", second: "1 Timothy 1:12-17", gospel: "Luke 15:1-32 (Lost Sheep, Lost Coin, Prodigal Son)" } },
    { id: "ot-25c", week: 25, half: "second", cycle: "C", name: "Twenty-Fifth Sunday in Ordinary Time",
      readings: { first: "Amos 8:4-7", psalm: "Psalm 113:1-2,4-8", second: "1 Timothy 2:1-8", gospel: "Luke 16:1-13 (Dishonest Steward)" } },
    { id: "ot-26c", week: 26, half: "second", cycle: "C", name: "Twenty-Sixth Sunday in Ordinary Time",
      readings: { first: "Amos 6:1a,4-7", psalm: "Psalm 146:6-10", second: "1 Timothy 6:11-16", gospel: "Luke 16:19-31 (Lazarus and the Rich Man)" } },
    { id: "ot-27c", week: 27, half: "second", cycle: "C", name: "Twenty-Seventh Sunday in Ordinary Time",
      readings: { first: "Habakkuk 1:2-3,2:2-4", psalm: "Psalm 95:1-2,6-9", second: "2 Timothy 1:6-8,13-14", gospel: "Luke 17:5-10 (Increase Our Faith)" } },
    { id: "ot-28c", week: 28, half: "second", cycle: "C", name: "Twenty-Eighth Sunday in Ordinary Time",
      readings: { first: "2 Kings 5:14-17", psalm: "Psalm 98:1-4", second: "2 Timothy 2:8-13", gospel: "Luke 17:11-19 (Ten Lepers)" } },
    { id: "ot-29c", week: 29, half: "second", cycle: "C", name: "Twenty-Ninth Sunday in Ordinary Time",
      readings: { first: "Exodus 17:8-13", psalm: "Psalm 121:1-8", second: "2 Timothy 3:14-4:2", gospel: "Luke 18:1-8 (Persistent Widow)" } },
    { id: "ot-30c", week: 30, half: "second", cycle: "C", name: "Thirtieth Sunday in Ordinary Time",
      readings: { first: "Sirach 35:12-14,16-18", psalm: "Psalm 34:2-3,17-19,23", second: "2 Timothy 4:6-8,16-18", gospel: "Luke 18:9-14 (Pharisee and Tax Collector)" } },
    { id: "ot-31c", week: 31, half: "second", cycle: "C", name: "Thirty-First Sunday in Ordinary Time",
      readings: { first: "Wisdom 11:22-12:2", psalm: "Psalm 145:1-2,8-11,13-14", second: "2 Thessalonians 1:11-2:2", gospel: "Luke 19:1-10 (Zacchaeus)" } },
    { id: "ot-32c", week: 32, half: "second", cycle: "C", name: "Thirty-Second Sunday in Ordinary Time",
      readings: { first: "2 Maccabees 7:1-2,9-14", psalm: "Psalm 17:1,5-6,8,15", second: "2 Thessalonians 2:16-3:5", gospel: "Luke 20:27-38 (Sadducees and the Resurrection)" } },
    { id: "ot-33c", week: 33, half: "second", cycle: "C", name: "Thirty-Third Sunday in Ordinary Time",
      readings: { first: "Malachi 3:19-20a", psalm: "Psalm 98:5-9", second: "2 Thessalonians 3:7-12", gospel: "Luke 21:5-19 (End Times)" } }
  ]
};



// ---------------------------------------------------------------------------
// Slot resolution + book pagination (ported from the original app.js wiring).
// ---------------------------------------------------------------------------

const LC = LiturgicalCalendar;

function stripCycleSuffix(id) { return id.replace(/-[abc]$/, ""); }

function buildSolemnityGroups() {
  const groups = {};
  LectionaryData.solemnities.forEach(e => {
    const g = stripCycleSuffix(e.id);
    if (!groups[g]) groups[g] = { entries: {}, anchor: e.anchor, name: e.name, rank: e.rank, color: e.color };
    groups[g].entries[e.cycle] = e;
    if (e.cycle === "ALL") { groups[g].name = e.name; groups[g].rank = e.rank; groups[g].color = e.color; }
  });
  return groups;
}

function resolveAnchorDate(anchor, ly) {
  switch (anchor.type) {
    case "fixed": return LC.utcDate(ly.endYear + anchor.yearOffset, anchor.month, anchor.day);
    case "computed":
      if (anchor.offsetFrom === "sundayAfter") {
        const base = LC.addDays(ly.dates[anchor.key], 4);
        return LC.addDays(base, 7 * (anchor.n - 1));
      }
      return ly.dates[anchor.key];
    case "advent": return LC.addDays(ly.dates.advent1, 7 * (anchor.n - 1));
    case "easterOffset": return LC.addDays(ly.dates.easter, anchor.days);
    case "holyFamily":
      if (ly.dates.christmas.getUTCDay() === 0) return LC.utcDate(ly.endYear - 1, 12, 30);
      return LC.sundayOnOrAfter(LC.addDays(ly.dates.christmas, 1));
    default: throw new Error("Unknown anchor type: " + anchor.type);
  }
}

function buildSlots(endYear) {
  const ly = LC.getLiturgicalYear(endYear);
  const slots = [];

  const groups = buildSolemnityGroups();
  Object.keys(groups).forEach(g => {
    const meta = groups[g];
    const date = resolveAnchorDate(meta.anchor, ly);
    const readingsByCycle = {};
    Object.keys(meta.entries).forEach(c => { readingsByCycle[c] = meta.entries[c].readings; });
    slots.push({ id: g, kind: "solemnity", name: meta.name, rank: meta.rank, color: meta.color, date, readingsByCycle });
  });

  for (let n = 1; n <= 4; n++) {
    const date = LC.addDays(ly.dates.advent1, 7 * (n - 1));
    const readingsByCycle = {}; let name = "";
    LectionaryData.advent.filter(e => e.anchor.n === n).forEach(e => { readingsByCycle[e.cycle] = e.readings; name = e.name; });
    slots.push({ id: `advent-${n}`, kind: "advent", name, rank: "", color: n === 3 ? "rose" : "violet", date, readingsByCycle });
  }

  for (let n = 1; n <= 5; n++) {
    const date = resolveAnchorDate({ type: "computed", key: "ashWednesday", offsetFrom: "sundayAfter", n }, ly);
    const readingsByCycle = {}; let name = "";
    LectionaryData.lent.filter(e => e.anchor.n === n).forEach(e => { readingsByCycle[e.cycle] = e.readings; name = e.name; });
    slots.push({ id: `lent-${n}`, kind: "lent", name, rank: "", color: n === 4 ? "rose" : "violet", date, readingsByCycle });
  }

  [7, 14, 21, 28, 35, 42].forEach((days, idx) => {
    const n = idx + 2;
    const date = LC.addDays(ly.dates.easter, days);
    const readingsByCycle = {}; let name = "";
    LectionaryData.easter.filter(e => e.anchor.days === days).forEach(e => { readingsByCycle[e.cycle] = e.readings; name = e.name; });
    slots.push({ id: `easter-${n}`, kind: "easter", name, rank: "", color: "white", date, readingsByCycle });
  });

  const ot1 = ly.seasons.find(s => s.key === "ot1");
  let cursor = LC.sundayOnOrAfter(ot1.start), i = 0;
  while (cursor <= ot1.end) {
    const week = i + 2;
    const readingsByCycle = {}; let name = "";
    LectionaryData.ot.filter(e => e.half === "first" && e.week === week).forEach(e => { readingsByCycle[e.cycle] = e.readings; name = e.name; });
    slots.push({ id: `ot1-${week}`, kind: "ot", name, rank: "", color: "green", date: cursor, readingsByCycle });
    cursor = LC.addDays(cursor, 7); i++;
  }

  const ot2 = ly.seasons.find(s => s.key === "ot2");
  const exclude = new Set([ly.dates.trinitySunday, ly.dates.corpusChristi, ly.dates.christTheKing].map(d => d.getTime()));
  const ot2Sundays = [];
  cursor = LC.sundayOnOrAfter(ot2.start);
  while (cursor <= ot2.end) {
    if (!exclude.has(cursor.getTime())) ot2Sundays.push(cursor);
    cursor = LC.addDays(cursor, 7);
  }
  const count = ot2Sundays.length;
  ot2Sundays.forEach((date, idx) => {
    const week = 33 - (count - 1 - idx);
    const readingsByCycle = {}; let name = "";
    LectionaryData.ot.filter(e => e.half === "second" && e.week === week).forEach(e => { readingsByCycle[e.cycle] = e.readings; name = e.name; });
    slots.push({ id: `ot2-${week}`, kind: "ot", name, rank: "", color: "green", date, readingsByCycle });
  });

  slots.sort((a, b) => a.date - b.date);
  return { liturgicalYear: ly, slots };
}

function readingsForCycle(slot, cycle) {
  return slot.readingsByCycle[cycle] || slot.readingsByCycle.ALL || null;
}

function readingText(value, cycle) {
  if (value == null) return "\u2014";
  if (typeof value === "object") return value[cycle] || value.A;
  return value;
}

const COLOR_LABEL = { violet: "Violet", white: "White & Gold", green: "Green", red: "Red", rose: "Rose" };

function seasonOf(date, ly) {
  const t = date.getTime();
  const hit = ly.seasons.find(s => t >= s.start.getTime() && t <= s.end.getTime());
  return hit ? hit.label : "Ordinary Time";
}

const EVANGELIST = { Matthew: "M", Mark: "M", Luke: "L", John: "I" };

// Four pages per day: title / first+psalm / second / gospel.
// Spread s shows pages 2s and 2s+1, so each Sunday is a self-contained pair of
// spreads that OPENS on the left with its title page and ends with its gospel
// on the right. No Sunday ever shares a spread with the one before it.
function buildPages(slots, cycle, ly) {
  const pages = [];
  slots.forEach((slot, d) => {
    const r = readingsForCycle(slot, cycle) || {};
    const gospel = readingText(r.gospel, cycle);
    const book = (gospel.match(/^(Matthew|Mark|Luke|John)/) || [])[1];
    const season = seasonOf(slot.date, ly);
    const folio = () => String(pages.length + 1);
    pages.push({ kind: "title", day: d, side: "left", season, name: slot.name,
      date: LC.formatDate(slot.date), rank: slot.rank, cycle,
      colorKey: slot.color, colorLabel: COLOR_LABEL[slot.color] || slot.color, folio: folio() });
    pages.push({ kind: "readings", day: d, side: "right", season, running: slot.name, folio: folio(),
      items: [{ label: "First Reading", text: readingText(r.first, cycle) },
              { label: "Responsorial Psalm", text: readingText(r.psalm, cycle) }] });
    pages.push({ kind: "readings", day: d, side: "left", season, running: slot.name, folio: folio(),
      items: [{ label: "Second Reading", text: readingText(r.second, cycle) }] });
    pages.push({ kind: "readings", day: d, side: "right", season, running: slot.name, folio: folio(),
      initial: EVANGELIST[book] || null, accent: slot.color,
      items: [{ label: "Gospel", text: gospel }] });
  });
  return pages;
}

window.LectionaryModule = {
  LiturgicalCalendar: LiturgicalCalendar,
  LectionaryData: LectionaryData,
  buildSlots: buildSlots,
  readingsForCycle: readingsForCycle,
  readingText: readingText,
  buildPages: buildPages,
  seasonOf: seasonOf,
  COLOR_LABEL: COLOR_LABEL
};
window.dispatchEvent(new Event("lectionary-module-ready"));
})();
