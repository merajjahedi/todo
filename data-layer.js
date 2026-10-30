// این لایهٔ آزمایشی اطلاعات حساب و برنامه‌ها را موقتاً در حافظهٔ مرورگر نگه می‌دارد.
// بعداً می‌توان همین توابع را به‌جای این نسخه به Supabase وصل کرد.
// رمزها به شکل متن نگهداری نمی‌شوند؛ این نسخه از هشِ PBKDF2 استفاده می‌کند.
(function () {
  const ACCOUNTS_KEY = "daily-planner-accounts-v1";
  const SESSION_KEY = "daily-planner-session-v1";
  const LEGACY_DATA_KEY = "my-tasks-v1";
  const PASSWORD_ROUNDS = 210000;
  const encoder = new TextEncoder();

  function readAccounts() {
    const saved = localStorage.getItem(ACCOUNTS_KEY);
    if (!saved) return {};

    const accounts = JSON.parse(saved);
    if (!accounts || typeof accounts !== "object" || Array.isArray(accounts)) {
      throw new Error("اطلاعات حساب‌ها قابل خواندن نیست.");
    }
    let updated = false;
    for (const account of Object.values(accounts)) {
      if (typeof account.isPremium !== "boolean") {
        account.isPremium = false;
        updated = true;
      }
    }
    if (updated) localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    return accounts;
  }

  function writeAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  function currentUserId() {
    return localStorage.getItem(SESSION_KEY);
  }

  function getAccount() {
    const id = currentUserId();
    if (!id) return null;
    return readAccounts()[id] || null;
  }

  function cleanProfile(account) {
    return {
      id: account.id,
      email: account.email,
      username: account.username,
      joinedAt: account.joinedAt,
      avatar: account.avatar,
      isPremium: account.isPremium === true,
      score: account.score,
      completedTotal: account.completedTotal,
      scoreHistory: [...account.scoreHistory],
      dailyBonuses: { ...account.dailyBonuses },
    };
  }

  function bytesToHex(bytes) {
    return [...new Uint8Array(bytes)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
  }

  // رمز را با نمک جداگانه و PBKDF2 هش می‌کند؛ خروجی قابل تبدیل به رمز اصلی نیست.
  async function hashPassword(password, salt) {
    if (!crypto.subtle) {
      throw new Error("برای ساخت امن حساب، برنامه را با یک نشانی امن یا localhost باز کن.");
    }
    const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
      "deriveBits",
    ]);
    const hash = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: hexToBytes(salt), iterations: PASSWORD_ROUNDS, hash: "SHA-256" },
      key,
      256,
    );
    return bytesToHex(hash);
  }

  function makeSalt() {
    return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  }

  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "full" }).format(date);
  }

  // تاریخ محلی را به شکلی یکدست درمی‌آورد تا دورهای یک روز کنار هم بمانند.
  // ورودی: تاریخ یا متن تاریخ؛ خروجی: تاریخ به شکل سال-ماه-روز.
  function dateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return todayKey();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`;
  }

  function validTask(task) {
    return (
      task &&
      typeof task.id === "string" &&
      typeof task.title === "string" &&
      typeof task.completed === "boolean" &&
      (task.time === undefined ||
        task.time === null ||
        (typeof task.time === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(task.time)))
    );
  }

  // بررسی می‌کند ساعت یک برنامه رسیده باشد تا تیک‌زدنش مجاز شود.
  // ورودی: برنامه و زمان فعلی؛ خروجی: درست اگر برنامه بدون ساعت است یا موعدش رسیده.
  function canCheckTask(task, now = new Date()) {
    if (!task || task.time === null || task.time === undefined) return true;
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(task.time)) return false;
    const scheduledMinutes =
      Number(task.time.slice(0, 2)) * 60 + Number(task.time.slice(3, 5));
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return currentMinutes >= scheduledMinutes;
  }

  // زمان را با رقم‌های فارسی آماده می‌کند تا پیام خطا با نوشته‌های برنامه هماهنگ باشد.
  // ورودی: زمان مثل 09:30؛ خروجی: همان زمان با رقم‌های فارسی.
  function persianTime(time) {
    return time.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
  }

  function normalizeAppData(data) {
    if (Array.isArray(data)) {
      if (!data.every(validTask)) throw new Error("فهرست برنامه‌ها درست نیست.");
      return {
        tasks: data.map((task) => ({
          ...task,
          time: task.time === undefined ? "09:00" : task.time,
        })),
        archives: [],
        currentDay: todayKey(),
        currentRound: 1,
      };
    }

    if (
      !data ||
      !Array.isArray(data.tasks) ||
      !Array.isArray(data.archives) ||
      !data.tasks.every(validTask)
    ) {
      throw new Error("اطلاعات برنامه‌ها قابل خواندن نیست.");
    }

    const daysByKey = new Map();
    for (const archive of data.archives) {
      if (!archive || typeof archive.id !== "string") {
        throw new Error("اطلاعات بایگانی قابل خواندن نیست.");
      }

      const closedAt = archive.closedAt || archive.archivedAt;
      const archiveDateKey =
        typeof archive.dateKey === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(archive.dateKey) &&
        !Number.isNaN(new Date(`${archive.dateKey}T12:00:00`).getTime());
      const validClosedAt =
        typeof closedAt === "string" && !Number.isNaN(new Date(closedAt).getTime());
      if ((!archiveDateKey && !validClosedAt) || (closedAt && !validClosedAt)) {
        throw new Error("تاریخ یکی از روزهای بایگانی درست نیست.");
      }
      const key =
        archiveDateKey
          ? archive.dateKey
          : dateKey(closedAt);
      let day = daysByKey.get(key);
      if (!day) {
        day = {
          id: archive.id,
          dateKey: key,
          archivedAt: closedAt || new Date(`${key}T12:00:00`).toISOString(),
          rounds: [],
        };
        daysByKey.set(key, day);
      }

      // قالب قدیمیِ یک روز، به شکل دور اول خوانده می‌شود تا داده‌های قبلی سالم بمانند.
      const savedRounds = Array.isArray(archive.rounds)
        ? archive.rounds
        : [{ id: `${archive.id}-round-1`, roundNumber: 1, closedAt, tasks: archive.tasks }];
      for (const round of savedRounds) {
        const validRoundDate =
          round &&
          (round.closedAt === undefined ||
            (typeof round.closedAt === "string" &&
              !Number.isNaN(new Date(round.closedAt).getTime())));
        if (
          !round ||
          !Array.isArray(round.tasks) ||
          !round.tasks.every(validTask) ||
          !validRoundDate
        ) {
          throw new Error("اطلاعات یکی از دورهای بایگانی قابل خواندن نیست.");
        }
        day.rounds.push({
          id: typeof round.id === "string" ? round.id : crypto.randomUUID(),
          roundNumber:
            Number.isInteger(round.roundNumber) && round.roundNumber > 0
              ? round.roundNumber
              : day.rounds.length + 1,
          closedAt: round.closedAt || closedAt || new Date(`${key}T12:00:00`).toISOString(),
          tasks: round.tasks.map((task) => ({
            ...task,
            time: task.time === undefined ? "09:00" : task.time,
          })),
        });
      }
    }

    // اگر چند آرشیو قدیمی برای یک تاریخ ثبت شده، با زمان بسته‌شدن مرتب و شماره‌گذاری می‌شوند.
    const archives = [...daysByKey.values()];
    for (const day of archives) {
      day.rounds.sort((first, second) => first.closedAt.localeCompare(second.closedAt));
      day.rounds.forEach((round, index) => {
        round.roundNumber = index + 1;
      });
    }
    archives.sort((first, second) => second.dateKey.localeCompare(first.dateKey));

    const currentDay = typeof data.currentDay === "string" ? data.currentDay : todayKey();
    const todayClosedRounds =
      archives.find((archive) => archive.dateKey === currentDay)?.rounds.length || 0;
    const savedRound =
      Number.isInteger(data.currentRound) && data.currentRound > 0 ? data.currentRound : 1;
    const currentRound = Math.max(savedRound, todayClosedRounds + 1);

    return {
      tasks: data.tasks.map((task) => ({
        ...task,
        time: task.time === undefined ? "09:00" : task.time,
      })),
      archives,
      currentDay,
      currentRound,
    };
  }

  // اگر برنامه‌های نسخهٔ قبلی وجود داشته باشند، فقط به نخستین حساب منتقل می‌شوند.
  function getInitialAppData(isFirstAccount) {
    if (isFirstAccount) {
      const legacy = localStorage.getItem(LEGACY_DATA_KEY);
      if (legacy) {
        return normalizeAppData(JSON.parse(legacy));
      }
    }
    return { tasks: [], archives: [], currentDay: todayKey(), currentRound: 1 };
  }

  // رویداد امتیاز را با تاریخ و دلیل روشن به دفتر امتیازها اضافه می‌کند.
  function addScoreEntry(account, amount, reason) {
    account.score += amount;
    account.scoreHistory.push({
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      reason,
      amount,
    });
  }

  // از تغییر تیک‌ها امتیاز می‌سازد و بونوس روز را در صورت نیاز می‌دهد یا پس می‌گیرد.
  function updateScores(account, oldData, newData) {
    const oldTasks = new Map(oldData.tasks.map((task) => [task.id, task]));
    const today = todayKey();
    const todayLabel = formatDate(new Date());
    const bonus = account.dailyBonuses[today] || { active: false, amount: 0 };
    let taskCompleted = false;
    let taskReopened = false;
    let newPendingTask = false;
    let taskRemoved = false;

    for (const task of newData.tasks) {
      const oldTask = oldTasks.get(task.id);
      if (!oldTask) {
        if (!task.completed) newPendingTask = true;
        continue;
      }
      if (oldTask.completed === task.completed) continue;

      if (task.completed) {
        account.completedTotal += 1;
        addScoreEntry(account, 1, `انجام برنامه: ${task.title}`);
        taskCompleted = true;
      } else {
        account.completedTotal = Math.max(0, account.completedTotal - 1);
        addScoreEntry(account, -1, `بازکردن برنامه: ${task.title}`);
        taskReopened = true;
      }
    }
    taskRemoved = oldData.tasks.some(
      (oldTask) => !newData.tasks.some((task) => task.id === oldTask.id),
    );

    const isFirstRound = oldData.currentRound === 1;
    if (isFirstRound && (taskReopened || newPendingTask) && bonus.active) {
      addScoreEntry(account, -bonus.amount, `پس‌گرفتن بونوس ${todayLabel}`);
      bonus.active = false;
      bonus.amount = 0;
    }

    const allDone =
      newData.tasks.length > 0 && newData.tasks.every((task) => task.completed);
    if (isFirstRound && (taskCompleted || taskRemoved) && allDone && !bonus.active) {
      bonus.amount = newData.tasks.length * 2;
      bonus.active = true;
      addScoreEntry(account, bonus.amount, `بونوس پایان روز ${todayLabel}`);
    }

    account.dailyBonuses[today] = bonus;
  }

  async function register({ email, username, password }) {
    const accounts = readAccounts();
    if (typeof email !== "string" || typeof username !== "string" || typeof password !== "string") {
      throw new Error("اطلاعات ثبت‌نام رو کامل وارد کن.");
    }
    const cleanEmail = email.trim();
    const cleanUsername = username.trim();
    const normalizedEmail = cleanEmail.toLowerCase();
    const normalizedUsername = cleanUsername.toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error("ایمیلت رو با شکل درست وارد کن.");
    }
    if (!/^[A-Za-z0-9_]{3,20}$/.test(cleanUsername)) {
      throw new Error("یوزرنیم باید ۳ تا ۲۰ حرف انگلیسی، عدد یا زیرخط باشه.");
    }
    if (password.length < 8) throw new Error("رمز عبور باید دست‌کم ۸ کاراکتر باشه.");
    if (Object.values(accounts).some((account) => account.email === normalizedEmail)) {
      throw new Error("این ایمیل قبلاً برای یک حساب استفاده شده.");
    }
    if (Object.values(accounts).some((account) => account.username === normalizedUsername)) {
      throw new Error("این یوزرنیم قبلاً انتخاب شده؛ یکی دیگه امتحان کن.");
    }

    const salt = makeSalt();
    const passwordHash = await hashPassword(password, salt);
    const id = crypto.randomUUID();
    const isFirstAccount = Object.keys(accounts).length === 0;
    const account = {
      id,
      email: normalizedEmail,
      username: cleanUsername,
      salt,
      passwordHash,
      joinedAt: new Date().toISOString(),
      avatar: "",
      score: 0,
      completedTotal: 0,
      scoreHistory: [],
      dailyBonuses: {},
      isPremium: false,
      appData: getInitialAppData(isFirstAccount),
    };

    accounts[id] = account;
    writeAccounts(accounts);
    if (isFirstAccount && localStorage.getItem(LEGACY_DATA_KEY) !== null) {
      localStorage.removeItem(LEGACY_DATA_KEY);
    }
    localStorage.setItem(SESSION_KEY, id);
    return cleanProfile(account);
  }

  async function login(username, password) {
    const accounts = readAccounts();
    const normalizedUsername = username.trim().toLowerCase();
    const account = Object.values(accounts).find(
      (item) => item.username.toLowerCase() === normalizedUsername,
    );
    if (!account) throw new Error("یوزرنیم یا رمز درست نیست. دوباره امتحان کن.");

    const passwordHash = await hashPassword(password, account.salt);
    if (passwordHash !== account.passwordHash) {
      throw new Error("یوزرنیم یا رمز درست نیست. دوباره امتحان کن.");
    }

    localStorage.setItem(SESSION_KEY, account.id);
    return cleanProfile(account);
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  function getCurrentUser() {
    const account = getAccount();
    return account ? cleanProfile(account) : null;
  }

  function getProfile() {
    const account = getAccount();
    if (!account) throw new Error("برای دیدن پروفایل، اول وارد حسابت شو.");
    return cleanProfile(account);
  }

  function getAppData() {
    const accounts = readAccounts();
    const id = currentUserId();
    const account = id && accounts[id];
    if (!account) throw new Error("برای دیدن برنامه‌ها، اول وارد حسابت شو.");
    account.appData = normalizeAppData(account.appData || { tasks: [], archives: [] });
    // با شروع روز تازه، شمار دورها از یک شروع می‌شود و برنامه‌های ناتمام حفظ می‌شوند.
    if (account.appData.currentDay !== todayKey()) {
      account.appData.currentDay = todayKey();
      account.appData.currentRound = 1;
    }
    writeAccounts(accounts);
    return JSON.parse(JSON.stringify(account.appData));
  }

  function saveAppData(data) {
    const accounts = readAccounts();
    const id = currentUserId();
    const account = id && accounts[id];
    if (!account) throw new Error("نشست حسابت تموم شده؛ دوباره وارد شو.");

    const nextData = normalizeAppData(data);
    const previousData = normalizeAppData(account.appData || { tasks: [], archives: [] });
    const previousTasks = new Map(previousData.tasks.map((task) => [task.id, task]));
    for (const task of nextData.tasks) {
      const previousTask = previousTasks.get(task.id);
      if (task.completed && previousTask && !previousTask.completed && !canCheckTask(task)) {
        throw new Error(
          `هنوز وقتش نرسیده؛ از ساعت ${persianTime(task.time)} می‌تونی تیکش بزنی.`,
        );
      }
    }
    if (!account.isPremium && nextData.currentRound > 8 && nextData.tasks.length > 0) {
      throw new Error(
        "به سقف مجاز روزانه نسخه رایگان رسیدی. با تهیه نسخه پریمیوم می‌تونی هر روز بدون محدودیت دور بسازی.",
      );
    }
    updateScores(account, previousData, nextData);
    account.appData = nextData;
    writeAccounts(accounts);
    return true;
  }

  // وضعیت تیک یک برنامه را عوض می‌کند و پیش از انجام، زمان مقرر را بررسی می‌کند.
  // ورودی: شناسهٔ برنامه و وضعیت تازه؛ خروجی: دادهٔ به‌روز یا خطا اگر زمان نرسیده باشد.
  function setTaskCompleted(taskId, completed) {
    const accounts = readAccounts();
    const id = currentUserId();
    const account = id && accounts[id];
    if (!account) throw new Error("نشست حسابت تموم شده؛ دوباره وارد شو.");
    if (typeof taskId !== "string" || typeof completed !== "boolean") {
      throw new Error("وضعیت برنامه درست نیست.");
    }

    const oldData = normalizeAppData(account.appData || { tasks: [], archives: [] });
    const newData = JSON.parse(JSON.stringify(oldData));
    const task = newData.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("این برنامه دیگه توی برنامه‌های امروز نیست.");
    if (completed && !task.completed && !canCheckTask(task)) {
      throw new Error(
        `هنوز وقتش نرسیده؛ از ساعت ${persianTime(task.time)} می‌تونی تیکش بزنی.`,
      );
    }

    task.completed = completed;
    updateScores(account, oldData, newData);
    account.appData = newData;
    writeAccounts(accounts);
    return JSON.parse(JSON.stringify(newData));
  }

  // دور کامل‌شده را در روز خودش می‌گذارد و دور بعد را برای همان روز آماده می‌کند.
  // ورودی ندارد؛ خروجی: دادهٔ تازه و شمارهٔ دور بعد، یا خطای روشن.
  function closeRound() {
    const accounts = readAccounts();
    const id = currentUserId();
    const account = id && accounts[id];
    if (!account) throw new Error("نشست حسابت تموم شده؛ دوباره وارد شو.");

    const data = normalizeAppData(account.appData || { tasks: [], archives: [] });
    if (data.tasks.length === 0 || !data.tasks.every((task) => task.completed)) {
      throw new Error("برای بستن دور، همهٔ برنامه‌ها باید انجام شده باشن.");
    }
    if (!account.isPremium && data.currentRound > 8) {
      throw new Error(
        "به سقف مجاز روزانه نسخه رایگان رسیدی. با تهیه نسخه پریمیوم می‌تونی هر روز بدون محدودیت دور بسازی.",
      );
    }

    const closedAt = new Date().toISOString();
    const key = todayKey();
    let day = data.archives.find((archive) => archive.dateKey === key);
    if (!day) {
      day = {
        id: crypto.randomUUID(),
        dateKey: key,
        archivedAt: closedAt,
        rounds: [],
      };
      data.archives.unshift(day);
    }
    day.rounds.push({
      id: crypto.randomUUID(),
      roundNumber: data.currentRound,
      closedAt,
      tasks: data.tasks
        .slice()
        .sort((first, second) => {
          if (first.time === null) return second.time === null ? 0 : 1;
          if (second.time === null) return -1;
          return first.time.localeCompare(second.time);
        })
        .map((task) => ({
          ...task,
          time: task.time === undefined ? "09:00" : task.time,
        })),
    });
    day.rounds.sort((first, second) => first.roundNumber - second.roundNumber);
    data.tasks = [];
    data.currentDay = key;
    data.currentRound += 1;

    account.appData = data;
    writeAccounts(accounts);
    return {
      appData: JSON.parse(JSON.stringify(data)),
      roundInfo: {
        roundNumber: data.currentRound,
        isPremium: account.isPremium === true,
        maxRounds: account.isPremium === true ? null : 8,
        canCreateRound: account.isPremium === true || data.currentRound <= 8,
      },
    };
  }

  // شمارهٔ دور جاری و اجازهٔ ساخت دور تازه را برای صفحه‌ها برمی‌گرداند.
  // ورودی ندارد؛ خروجی: شمارهٔ دور، سقف رایگان و امکان ادامه.
  function getRoundInfo() {
    const account = getAccount();
    if (!account) throw new Error("برای دیدن دورها، اول وارد حسابت شو.");
    const data = normalizeAppData(account.appData || { tasks: [], archives: [] });
    const isPremium = account.isPremium === true;
    return {
      roundNumber: data.currentRound,
      isPremium,
      maxRounds: isPremium ? null : 8,
      canCreateRound: isPremium || data.currentRound <= 8,
    };
  }

  // فقط برای تست: وضعیت پریمیوم حساب فعلی را از کنسول مرورگر روشن یا خاموش می‌کند.
  // ورودی: درست برای پریمیوم و نادرست برای حساب رایگان؛ خروجی ندارد.
  function setPremiumForTesting(isPremium = true) {
    const accounts = readAccounts();
    const id = currentUserId();
    const account = id && accounts[id];
    if (!account) throw new Error("برای تغییر وضعیت آزمایشی، اول وارد حسابت شو.");
    account.isPremium = isPremium === true;
    writeAccounts(accounts);
    return account.isPremium;
  }

  function getProfileStats() {
    const account = getAccount();
    if (!account) throw new Error("برای دیدن امتیازها، اول وارد حسابت شو.");

    const appData = normalizeAppData(account.appData || { tasks: [], archives: [] });
    const tasks = appData.tasks;
    const completedToday = tasks.filter((task) => task.completed).length;
    const dailyBonus = account.dailyBonuses[todayKey()] || { active: false, amount: 0 };
    return {
      score: account.score,
      completedTotal: account.completedTotal,
      todayTotal: tasks.length,
      completedToday,
      currentRound: appData.currentRound,
      bonusAmount: dailyBonus.amount,
      bonusActive: dailyBonus.active,
      scoreHistory: [...account.scoreHistory].reverse(),
    };
  }

  async function changePassword(currentPassword, newPassword) {
    const accounts = readAccounts();
    const id = currentUserId();
    const account = id && accounts[id];
    if (!account) throw new Error("برای تغییر رمز، اول وارد حسابت شو.");
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      throw new Error("رمز فعلی و رمز تازه رو وارد کن.");
    }
    if (newPassword.length < 8) throw new Error("رمز تازه باید دست‌کم ۸ کاراکتر باشه.");

    const currentHash = await hashPassword(currentPassword, account.salt);
    if (currentHash !== account.passwordHash) {
      throw new Error("رمز فعلی درست نیست. دوباره بررسیش کن.");
    }

    account.salt = makeSalt();
    account.passwordHash = await hashPassword(newPassword, account.salt);
    writeAccounts(accounts);
    return true;
  }

  function saveAvatar(avatar) {
    const accounts = readAccounts();
    const id = currentUserId();
    const account = id && accounts[id];
    if (!account) throw new Error("برای تغییر عکس، اول وارد حسابت شو.");
    if (
      typeof avatar !== "string" ||
      avatar.length > 500000 ||
      !/^data:image\/(?:jpeg;base64,|svg\+xml,)/.test(avatar)
    ) {
      throw new Error("این عکس قابل ذخیره نیست؛ یه عکس دیگه انتخاب کن.");
    }
    account.avatar = avatar;
    writeAccounts(accounts);
    return true;
  }

  window.dataLayer = Object.freeze({
    register,
    login,
    logout,
    getCurrentUser,
    getProfile,
    getAppData,
    saveAppData,
    canCheckTask,
    setTaskCompleted,
    closeRound,
    getRoundInfo,
    setPremiumForTesting,
    getProfileStats,
    changePassword,
    saveAvatar,
  });
})();
