// این فایل صفحه‌ها و رویدادهای برنامه را راه‌اندازی می‌کند؛ نگهداری داده‌ها با data-layer.js است.
const DEFAULT_TIME = "09:00";
const WHEEL_ROW_HEIGHT = 40;
const page = document.body.dataset.page;
const storageNotice = document.querySelector("#storage-notice");
let taskToastTimer;
// این وضعیت فقط برای نمایش همین صفحه است؛ خواندن و نوشتن پایدار از لایهٔ داده می‌آید.
const state = {
  tasks: [],
  archives: [],
  currentDay: "",
  currentRound: 1,
  isPremium: false,
};

// برنامه‌های همین کاربر را از راه لایهٔ داده ذخیره می‌کند و نتیجه را برمی‌گرداند.
// ورودی ندارد؛ خروجی: درست‌بودن ذخیره‌سازی، و در صورت خطا پیام مناسب به کاربر.
async function saveState() {
  try {
    await window.dataLayer.saveAppData({
      tasks: state.tasks,
      archives: state.archives,
      currentDay: state.currentDay,
      currentRound: state.currentRound,
    });
    if (storageNotice) storageNotice.hidden = true;
    return true;
  } catch {
    if (storageNotice) {
      storageNotice.textContent =
        "ذخیره در این مرورگر ممکن نیست؛ تغییرها بعد از بستن صفحه از بین می‌رن.";
      storageNotice.hidden = false;
    }
    return false;
  }
}

// رقم‌های انگلیسی یک مقدار را به رقم‌های فارسی تبدیل می‌کند.
// ورودی: هر مقداری که به متن تبدیل شود؛ خروجی: همان متن با رقم‌های فارسی.
function toPersianDigits(value) {
  // این تابع رقم‌به‌رقم جای رقم انگلیسی را با رقم فارسی هم‌ارزش عوض می‌کند.
  return String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

// ساعت را برای نمایش با رقم‌های فارسی آماده می‌کند.
// ورودی: ساعت به شکل ۲۴ساعته؛ خروجی: متن ساعت و دقیقه با رقم‌های فارسی.
function formatTime(time) {
  return `${toPersianDigits(time.slice(0, 2))}:${toPersianDigits(time.slice(3, 5))}`;
}

// بررسی می‌کند تیک‌زدن یک برنامه در همین لحظه مجاز باشد.
// ورودی: برنامه؛ خروجی: درست اگر موعدش رسیده یا برایش ساعتی تعیین نشده باشد.
function canCheckTask(task) {
  return window.dataLayer.canCheckTask(task);
}

// پیام شیشه‌ای کوتاهی را نشان می‌دهد و پس از چند لحظه محوش می‌کند.
// ورودی: متن پیام؛ خروجی ندارد و ظاهر پیام روی صفحه را به‌روز می‌کند.
function showTaskToast(message) {
  const toast = document.querySelector("#task-toast");
  if (!toast) return;
  window.clearTimeout(taskToastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.remove("is-visible");
  window.requestAnimationFrame(() => toast.classList.add("is-visible"));
  taskToastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => {
      toast.hidden = true;
    }, 240);
  }, 2800);
}

// یک نسخهٔ مرتب‌شده از برنامه‌ها برمی‌گرداند؛ فهرست اصلی را تغییر نمی‌دهد.
// ورودی: فهرست برنامه‌ها؛ خروجی: برنامه‌ها از ساعت زودتر به دیرتر.
function sortedTasks(tasks) {
  // از نسخه‌ای جداگانه مرتب می‌کنیم تا ترتیب ذخیره‌شدهٔ اصلی بی‌دلیل عوض نشود.
  // برنامه‌های ساعت‌دار اول می‌آیند و ساعتشان از زودتر به دیرتر مرتب می‌شود.
  // برنامه‌های بدون ساعت بعد از آن‌ها و با همان ترتیب قبلی قرار می‌گیرند.
  return [...tasks].sort((first, second) => {
    if (first.time === null) return second.time === null ? 0 : 1;
    if (second.time === null) return -1;
    return first.time.localeCompare(second.time);
  });
}

// وقتی کاربر پایان روز را تأیید کرد، برنامه‌های انجام‌شده را همراه تاریخ بایگانی می‌کند.
// ورودی ندارد؛ خروجی: درست اگر روز ذخیره شد، وگرنه نادرست.
async function archiveCurrentList() {
  // روز خالی یا دارای برنامهٔ ناتمام نباید بسته شود.
  if (state.tasks.length === 0 || !state.tasks.every((task) => task.completed)) return false;
  try {
    // لایهٔ داده دور را به تاریخ مربوط وصل می‌کند و شمارهٔ دور بعد را نگه می‌دارد.
    const result = window.dataLayer.closeRound();
    state.tasks = result.appData.tasks;
    state.archives = result.appData.archives;
    state.currentDay = result.appData.currentDay;
    state.currentRound = result.appData.currentRound;
    if (storageNotice) storageNotice.hidden = true;
    return true;
  } catch (error) {
    if (storageNotice) {
      storageNotice.textContent = error.message || "بستن این دور انجام نشد؛ دوباره امتحان کن.";
      storageNotice.hidden = false;
    }
    return false;
  }
}

// ردیف‌های برنامه را در صفحه می‌سازد و در صورت نیاز امکان تغییرشان را می‌دهد.
// ورودی: جای نمایش، فهرست برنامه‌ها و تنظیماتِ قابل‌ویرایش بودن؛ خروجی ندارد و صفحه را به‌روز می‌کند.
function renderTaskList(listElement, tasks, { editable, onChange } = {}) {
  listElement.replaceChildren();

  // هر برنامه با ترتیب ساعت نمایش داده می‌شود.
  for (const task of sortedTasks(tasks)) {
    const item = document.createElement("li");
    item.className = `task-item${task.completed ? " is-complete" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.className = "task-checkbox";
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    const canCheckNow = canCheckTask(task);
    checkbox.disabled = !editable || (!task.completed && !canCheckNow);
    checkbox.classList.toggle("is-waiting", editable && !task.completed && !canCheckNow);
    checkbox.setAttribute("aria-label", `انجام‌شدن ${task.title}`);
    if (editable) {
      // با تغییر تیک، وضعیت انجام برنامه به‌روز می‌شود و صفحهٔ بیرونی از تغییر باخبر می‌شود.
      checkbox.addEventListener("change", async () => {
        try {
          const updated = window.dataLayer.setTaskCompleted(task.id, checkbox.checked);
          state.tasks = updated.tasks;
          state.archives = updated.archives;
          state.currentDay = updated.currentDay;
          state.currentRound = updated.currentRound;
          await onChange();
        } catch (error) {
          checkbox.checked = task.completed;
          if (!canCheckTask(task)) {
            showTaskToast(
              `هنوز وقتش نرسیده؛ از ساعت ${formatTime(task.time)} می‌تونی تیکش بزنی`,
            );
          } else if (storageNotice) {
            storageNotice.textContent = error.message || "تغییر وضعیت برنامه انجام نشد.";
            storageNotice.hidden = false;
          }
        }
      });
      // چون چک‌باکسِ زودهنگام غیرفعال است، لمس ردیف هم همان پیام راهنما را نشان می‌دهد.
      item.addEventListener("click", (event) => {
        if (event.target.closest(".task-actions")) return;
        if (!task.completed && !canCheckTask(task)) {
          showTaskToast(
            `هنوز وقتش نرسیده؛ از ساعت ${formatTime(task.time)} می‌تونی تیکش بزنی`,
          );
        }
      });
    }

    const details = document.createElement("div");
    details.className = "task-details";
    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title;
    const time = document.createElement("span");
    time.className = task.time === null ? "task-time no-time-mark" : "task-time";
    time.dir = "ltr";
    if (task.time === null) {
      time.textContent = "◷";
      time.setAttribute("aria-label", "هر وقت شد، بدون ساعت");
    } else {
      time.textContent = formatTime(task.time);
    }
    details.append(title, time);

    item.append(checkbox, details);

    if (editable) {
      const actions = document.createElement("div");
      actions.className = "task-actions";
      const editButton = document.createElement("a");
      editButton.className = "icon-button edit-button";
      editButton.href = `add.html?edit=${encodeURIComponent(task.id)}`;
      editButton.textContent = "ویرایش";
      editButton.setAttribute("aria-label", `ویرایش ${task.title}`);
      const deleteButton = document.createElement("button");
      deleteButton.className = "icon-button delete-button";
      deleteButton.type = "button";
      deleteButton.textContent = "حذف";
      deleteButton.setAttribute("aria-label", `حذف ${task.title}`);
      // با انتخاب حذف، برنامه از فهرست امروز پاک و وضعیت ذخیره می‌شود.
      deleteButton.addEventListener("click", async () => {
        // برنامه‌هایی نگه داشته می‌شوند که شناسه‌شان با برنامهٔ انتخاب‌شده فرق دارد.
        state.tasks = state.tasks.filter((savedTask) => savedTask.id !== task.id);
        await onChange();
      });
      actions.append(editButton, deleteButton);
      item.append(actions);
    }

    listElement.append(item);
  }
}

// متن سلام را از روی ساعت روز انتخاب می‌کند.
// ورودی: ساعت فعلی از صفر تا ۲۳؛ خروجی: سلام مناسب همان ساعت.
function getGreeting(hour) {
  if (hour >= 5 && hour < 12) return "صبح بخیر";
  if (hour >= 12 && hour < 16) return "ظهر بخیر";
  if (hour >= 16 && hour < 20) return "عصر بخیر";
  return "شب بخیر";
}

// صفحهٔ اصلی را آماده می‌کند و برنامه‌ها، شمارنده و میزان پیشرفت را نشان می‌دهد.
// ورودی ندارد؛ خروجی ندارد و اطلاعات فعلی را در صفحه نمایش می‌دهد.
function initHome() {
  const taskList = document.querySelector("#task-list");
  const untimedTaskList = document.querySelector("#untimed-task-list");
  const untimedSection = document.querySelector("#untimed-section");
  const emptyState = document.querySelector("#empty-state");
  const progressTrack = document.querySelector("#progress-track");
  const finishDaySection = document.querySelector("#finish-day-section");
  const finishDayButton = document.querySelector("#finish-day-button");
  const finishDayHint = document.querySelector("#finish-day-hint");
  const finishDayDialog = document.querySelector("#finish-day-dialog");
  const confirmFinishDayButton = document.querySelector("#confirm-finish-day");
  const keepTodayButton = document.querySelector("#keep-today");
  const roundMessage = document.querySelector("#round-message");

  const now = new Date();
  document.querySelector("#greeting").textContent = getGreeting(now.getHours());
  document.querySelector("#today").textContent = new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "full",
  }).format(now);

  // فهرست و شمارنده‌ها را از نو با وضعیت فعلی هماهنگ می‌کند.
  // ورودی ندارد؛ خروجی ندارد و بخش‌های مربوط به فهرست را در صفحه به‌روز می‌کند.
  function render() {
    const timedTasks = state.tasks.filter((task) => task.time !== null);
    const untimedTasks = state.tasks.filter((task) => task.time === null);

    renderTaskList(taskList, timedTasks, {
      editable: true,
      onChange: async () => {
        // تیک یا حذف فقط ذخیره می‌شود؛ پایان روز را کاربر جداگانه انتخاب می‌کند.
        await saveState();
        render();
      },
    });
    renderTaskList(untimedTaskList, untimedTasks, {
      editable: true,
      onChange: async () => {
        // برنامه‌های بدون ساعت هم مثل بقیه فقط ذخیره می‌شوند و خودکار بایگانی نمی‌شوند.
        await saveState();
        render();
      },
    });

    const total = state.tasks.length;
    // تعداد برنامه‌های انجام‌شده برای محاسبهٔ درصد شمرده می‌شود.
    const completed = state.tasks.filter((task) => task.completed).length;
    // درصد پیشرفت از برنامه‌های انجام‌شده نسبت به کل برنامه‌ها به دست می‌آید.
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    document.querySelector("#task-count").textContent = toPersianDigits(total);
    document.querySelector("#round-number").textContent =
      state.isPremium || state.currentRound <= 8
        ? `دور ${toPersianDigits(state.currentRound)}`
        : "سقف امروز";
    document.querySelector("#progress-label").textContent =
      `${toPersianDigits(completed)} از ${toPersianDigits(total)} برنامه انجام شد`;
    document.querySelector("#progress-percent").textContent = `${toPersianDigits(percent)}٪`;
    progressTrack.setAttribute("aria-valuemax", String(total));
    progressTrack.setAttribute("aria-valuenow", String(completed));
    document.querySelector("#progress-fill").style.width = `${percent}%`;
    emptyState.hidden = total > 0;
    taskList.hidden = timedTasks.length === 0;
    untimedSection.hidden = untimedTasks.length === 0;
    const allComplete = total > 0 && completed === total;
    finishDaySection.hidden = total === 0;
    finishDayButton.disabled = !allComplete;
    finishDayButton.classList.toggle("is-ready", allComplete);
    finishDayHint.hidden = allComplete;
    document.querySelector("#archive-count").textContent = toPersianDigits(state.archives.length);
  }

  // پایان روز فقط پس از تکمیل همهٔ برنامه‌ها و تأیید دوباره در پنجره انجام می‌شود.
  finishDayButton.addEventListener("click", () => {
    if (!finishDayButton.disabled) finishDayDialog.showModal();
  });

  confirmFinishDayButton.addEventListener("click", async () => {
    finishDayDialog.close();
    if (await archiveCurrentList()) {
      render();
      roundMessage.textContent =
        state.isPremium || state.currentRound <= 8
          ? `دور ${toPersianDigits(state.currentRound)} امروز شروع شد.`
          : "دور هشتم بسته شد؛ سهم دورهای امروزت کامل شد.";
      roundMessage.hidden = false;
    }
  });

  keepTodayButton.addEventListener("click", () => finishDayDialog.close());
  finishDayDialog.addEventListener("click", (event) => {
    if (event.target === finishDayDialog) finishDayDialog.close();
  });

  render();
  // هر نیم دقیقه ساعت برنامه‌ها دوباره بررسی می‌شود تا چک‌باکس‌های موعدرسیده فعال شوند.
  const taskAvailabilityTimer = window.setInterval(render, 30000);
  window.addEventListener(
    "pagehide",
    () => window.clearInterval(taskAvailabilityTimer),
    { once: true },
  );
}

// چرخ انتخاب ساعت یا دقیقه را می‌سازد و تغییر انتخاب را به صفحه گزارش می‌کند.
// ورودی: جای چرخ، تعداد انتخاب‌ها، مقدار آغازین و واکنشی که با انتخاب تازه اجرا می‌شود.
// خروجی ندارد؛ گزینه‌ها و واکنش‌های چرخ را به صفحه اضافه می‌کند.
function initWheel(wheel, count, value, onSelect) {
  const options = document.createDocumentFragment();
  // گزینه‌ها پیش از افزودن به صفحه آماده می‌شوند تا ساخت چرخ روان‌تر باشد.
  for (let index = 0; index < count; index += 1) {
    const option = document.createElement("div");
    option.className = "wheel-option";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(index === value));
    option.dataset.value = String(index).padStart(2, "0");
    option.textContent = toPersianDigits(index).padStart(2, "۰");
    // با فشردن یک گزینه، چرخ روی همان ساعت یا دقیقه می‌ایستد.
    option.addEventListener("click", () => {
      wheel.scrollTo({ top: index * WHEEL_ROW_HEIGHT, behavior: "smooth" });
    });
    options.append(option);
  }
  wheel.append(options);
  wheel.scrollTop = value * WHEEL_ROW_HEIGHT;

  let scrollTimer;
  // پس از پایان حرکت چرخ، نزدیک‌ترین ردیف انتخاب می‌شود و مقدار تازه اعلام می‌شود.
  wheel.addEventListener("scroll", () => {
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      const index = Math.max(
        0,
        Math.min(count - 1, Math.round(wheel.scrollTop / WHEEL_ROW_HEIGHT)),
      );
      wheel.scrollTo({ top: index * WHEEL_ROW_HEIGHT, behavior: "smooth" });
      for (const [optionIndex, option] of [...wheel.children].entries()) {
        const selected = index === optionIndex;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-selected", String(selected));
      }
      onSelect(index);
    }, 90);
  });

  // کلیدهای صفحه‌کلید هم می‌توانند انتخاب چرخ را بالا، پایین یا به ابتدا و انتها ببرند.
  wheel.addEventListener("keydown", (event) => {
    const currentIndex = Math.round(wheel.scrollTop / WHEEL_ROW_HEIGHT);
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex += 1;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex -= 1;
    else if (event.key === "PageDown") nextIndex += 5;
    else if (event.key === "PageUp") nextIndex -= 5;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = count - 1;
    else return;

    event.preventDefault();
    wheel.scrollTo({
      top: Math.max(0, Math.min(count - 1, nextIndex)) * WHEEL_ROW_HEIGHT,
      behavior: "smooth",
    });
  });
}

// صفحهٔ افزودن و ویرایش برنامه را آماده می‌کند و اطلاعات فرم را ذخیره می‌کند.
// ورودی ندارد؛ خروجی ندارد و فرم، انتخاب‌گر زمان و رویداد ثبت را راه‌اندازی می‌کند.
function initAddPage() {
  const form = document.querySelector("#task-form");
  const input = document.querySelector("#task-input");
  const submitButton = document.querySelector("#submit-button");
  const hourWheel = document.querySelector("#hour-wheel");
  const minuteWheel = document.querySelector("#minute-wheel");
  const timePreview = document.querySelector("#time-preview");
  const timeControls = document.querySelector("#time-controls");
  const noTimeToggle = document.querySelector("#no-time-toggle");
  const query = new URLSearchParams(window.location.search);
  const editingId = query.get("edit");
  // شناسهٔ داخل نشانی صفحه با شناسهٔ برنامه‌ها سنجیده می‌شود تا برنامهٔ مورد ویرایش پیدا شود.
  const editingTask = state.tasks.find((task) => task.id === editingId);
  noTimeToggle.checked = Boolean(editingTask && editingTask.time === null);
  let selectedHour =
    editingTask && editingTask.time !== null ? Number(editingTask.time.slice(0, 2)) : 9;
  let selectedMinute =
    editingTask && editingTask.time !== null ? Number(editingTask.time.slice(3, 5)) : 0;

  // ساعت انتخاب‌شده را با رقم‌های فارسی در پیش‌نمایش فرم نشان می‌دهد.
  // ورودی و خروجی ندارد؛ متن پیش‌نمایش صفحه را به‌روز می‌کند.
  function updateTimePreview() {
    timePreview.textContent = noTimeToggle.checked
      ? "—"
      : formatTime(
          `${String(selectedHour).padStart(2, "0")}:${String(selectedMinute).padStart(2, "0")}`,
        );
  }

  // کلید روشن باشد، انتخاب‌گر محو می‌شود و دیگر با لمس یا صفحه‌کلید تغییر نمی‌کند.
  // ورودی ندارد؛ خروجی ندارد و ظاهر و دسترس‌پذیری انتخاب‌گر را هماهنگ می‌کند.
  function updateTimeControls() {
    const disabled = noTimeToggle.checked;
    timeControls.classList.toggle("is-disabled", disabled);
    for (const wheel of [hourWheel, minuteWheel]) {
      wheel.tabIndex = disabled ? -1 : 0;
      wheel.setAttribute("aria-disabled", String(disabled));
    }
    updateTimePreview();
  }

  initWheel(hourWheel, 24, selectedHour, (value) => {
    selectedHour = value;
    updateTimePreview();
  });
  initWheel(minuteWheel, 60, selectedMinute, (value) => {
    selectedMinute = value;
    updateTimePreview();
  });
  noTimeToggle.addEventListener("change", updateTimeControls);
  updateTimeControls();

  if (editingTask) {
    document.querySelector("#form-page-title").textContent = "ویرایش برنامه";
    document.title = "ویرایش برنامه | برنامه امروز";
    document.querySelector("#form-heading").textContent = "برنامه‌ات رو ویرایش کن";
    submitButton.textContent = "بذار توی برنامه‌م";
    input.value = editingTask.title;
  } else if (editingId) {
    storageNotice.textContent = "این برنامه دیگه توی برنامه‌های امروز نیست.";
    storageNotice.hidden = false;
  }

  // هنگام ثبت فرم، برنامهٔ تازه ساخته یا برنامهٔ موجود ویرایش و سپس ذخیره می‌شود.
  // ورودی: رویداد ثبت فرم؛ خروجی ندارد و در صورت موفقیت به صفحهٔ اصلی می‌رود.
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = input.value.trim();
    if (!title) return;

    const time = noTimeToggle.checked
      ? null
      : `${String(selectedHour).padStart(2, "0")}:${String(selectedMinute).padStart(2, "0")}`;
    if (editingTask) {
      // در حالت ویرایش، عنوان و ساعت همان برنامه تغییر می‌کنند.
      editingTask.title = title;
      editingTask.time = time;
    } else {
      // در حالت افزودن، یک برنامهٔ تازه با شناسه و وضعیت انجام‌نشده ساخته می‌شود.
      state.tasks.push({
        id: crypto.randomUUID(),
        title,
        time,
        completed: false,
      });
    }
    if (await saveState()) window.location.href = "index.html";
  });
}

// صفحهٔ روزهای گذشته را می‌سازد و هر فهرست روزانه را باز و بسته‌شدنی نمایش می‌دهد.
// ورودی ندارد؛ خروجی ندارد و فهرست بایگانی‌ها را در صفحه قرار می‌دهد.
function initArchives() {
  const archiveList = document.querySelector("#archive-list");
  const emptyState = document.querySelector("#archive-empty");
  const archiveTools = document.querySelector("#archive-tools");
  const selectionModeToggle = document.querySelector("#selection-mode-toggle");
  const selectAllControl = document.querySelector("#select-all-control");
  const selectAllToggle = document.querySelector("#select-all-toggle");
  const deleteSelectedButton = document.querySelector("#delete-selected-button");
  const deleteAllButton = document.querySelector("#delete-all-button");
  const confirmDialog = document.querySelector("#archive-confirm-dialog");
  const confirmTitle = document.querySelector("#confirm-title");
  const confirmDescription = document.querySelector("#confirm-description");
  const confirmDeleteButton = document.querySelector("#confirm-delete-button");
  const confirmKeepButton = document.querySelector("#confirm-keep-button");
  const selectedArchiveIds = new Set();
  let pendingDeleteIds = [];
  let deleteEverything = false;
  let deletionInProgress = false;

  // شمارنده، پیام خالی و ابزارهای حذف را با تعداد روزهای بایگانی هماهنگ می‌کند.
  function updateArchiveStatus() {
    const hasArchives = state.archives.length > 0;
    document.querySelector("#archive-count-badge").textContent =
      toPersianDigits(state.archives.length);
    emptyState.hidden = hasArchives;
    archiveTools.hidden = !hasArchives;
    selectAllControl.hidden = !selectionModeToggle.checked;
    deleteSelectedButton.hidden = !selectionModeToggle.checked;
    deleteSelectedButton.disabled = selectedArchiveIds.size === 0 || deletionInProgress;
    deleteAllButton.disabled = deletionInProgress;
    selectAllToggle.checked =
      hasArchives && selectedArchiveIds.size === state.archives.length;
    selectAllToggle.indeterminate =
      selectedArchiveIds.size > 0 && selectedArchiveIds.size < state.archives.length;
    archiveList.classList.toggle("is-selection-mode", selectionModeToggle.checked);
  }

  // همهٔ روزها را می‌سازد و برای هرکدام دکمهٔ بازکردن، انتخاب و حذف می‌گذارد.
  function renderArchives() {
    archiveList.replaceChildren();

    for (const archive of state.archives) {
      const section = document.createElement("section");
      section.className = "archive-entry";
      section.dataset.archiveId = archive.id;

      const heading = document.createElement("div");
      heading.className = "archive-entry-heading";

      const toggle = document.createElement("button");
      toggle.className = "archive-toggle";
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", "false");

      const label = document.createElement("span");
      label.className = "archive-date";
      const archivedDate = new Date(`${archive.dateKey}T12:00:00`);
      label.textContent = Number.isNaN(archivedDate.getTime())
        ? "روز ثبت نشده"
        : new Intl.DateTimeFormat("fa-IR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }).format(archivedDate);

      const count = document.createElement("span");
      count.className = "archive-task-count";
      const rounds = archive.rounds || [
        { roundNumber: 1, tasks: archive.tasks || [], closedAt: archive.archivedAt },
      ];
      const completedCount = rounds.reduce(
        (total, round) => total + round.tasks.filter((task) => task.completed).length,
        0,
      );
      count.textContent =
        `${toPersianDigits(rounds.length)} دور · ` +
        `${toPersianDigits(completedCount)} برنامه انجام‌شده`;
      const chevron = document.createElement("span");
      chevron.className = "archive-chevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = "⌄";
      toggle.append(label, count, chevron);

      const actions = document.createElement("div");
      actions.className = "archive-entry-actions";

      const selectLabel = document.createElement("label");
      selectLabel.className = "archive-select-control";
      selectLabel.setAttribute("aria-label", `انتخاب روز ${label.textContent}`);
      const selectCheckbox = document.createElement("input");
      selectCheckbox.className = "archive-select-checkbox";
      selectCheckbox.type = "checkbox";
      selectCheckbox.checked = selectedArchiveIds.has(archive.id);
      selectCheckbox.setAttribute("aria-label", `انتخاب روز ${label.textContent}`);
      selectCheckbox.addEventListener("change", () => {
        if (selectCheckbox.checked) selectedArchiveIds.add(archive.id);
        else selectedArchiveIds.delete(archive.id);
        updateArchiveStatus();
      });
      selectLabel.append(selectCheckbox);

      const deleteButton = document.createElement("button");
      deleteButton.className = "archive-delete-button";
      deleteButton.type = "button";
      deleteButton.setAttribute("aria-label", `حذف روز ${label.textContent}`);
      deleteButton.title = "حذف این روز";
      const trashIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      trashIcon.setAttribute("viewBox", "0 0 24 24");
      trashIcon.setAttribute("aria-hidden", "true");
      trashIcon.innerHTML =
        '<path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v5m4-5v5" />';
      deleteButton.append(trashIcon);
      deleteButton.addEventListener("click", () => {
        openDeleteConfirmation([archive.id], "single");
      });
      actions.append(selectLabel, deleteButton);
      heading.append(toggle, actions);

      const details = document.createElement("div");
      details.className = "archive-details";
      details.hidden = true;
      for (const [index, round] of rounds.entries()) {
        const roundSection = document.createElement("section");
        roundSection.className = "archive-round";
        const roundHeading = document.createElement("h3");
        roundHeading.className = "archive-round-heading";
        roundHeading.textContent = `دور ${toPersianDigits(round.roundNumber || index + 1)}`;
        const archivedTasks = document.createElement("ul");
        archivedTasks.className = "task-list archive-task-list";
        renderTaskList(archivedTasks, round.tasks, { editable: false });
        roundSection.append(roundHeading, archivedTasks);
        details.append(roundSection);
      }

      // با فشردن عنوان بایگانی، جزئیات آن باز یا بسته می‌شود.
      toggle.addEventListener("click", () => {
        const expanded = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", String(expanded));
        details.hidden = !expanded;
      });

      section.append(heading, details);
      archiveList.append(section);
    }

    updateArchiveStatus();
  }

  // پیش از حذف، نوع حذف را مشخص می‌کند و متن تأیید مناسب را نشان می‌دهد.
  function openDeleteConfirmation(archiveIds, mode) {
    pendingDeleteIds = archiveIds;
    deleteEverything = mode === "all";
    const removedRounds = state.archives
      .filter((archive) => archiveIds.includes(archive.id))
      .reduce(
        (total, archive) =>
          total + (archive.rounds?.length || (Array.isArray(archive.tasks) ? 1 : 0)),
        0,
      );

    if (mode === "single") {
      confirmTitle.textContent = "این روز برای همیشه پاک بشه؟";
      confirmDescription.textContent =
        `${toPersianDigits(removedRounds)} دور این روز با هم از بایگانی پاک می‌شن.`;
    } else if (mode === "selected") {
      confirmTitle.textContent = "روزهای انتخاب‌شده پاک بشن؟";
      confirmDescription.textContent =
        `${toPersianDigits(archiveIds.length)} روز و ${toPersianDigits(removedRounds)} دور برای همیشه پاک می‌شن.`;
    } else {
      confirmTitle.textContent = "همهٔ روزها پاک بشن؟";
      confirmDescription.textContent =
        `هشدار: همهٔ ${toPersianDigits(archiveIds.length)} روز و ${toPersianDigits(removedRounds)} دور برای همیشه پاک می‌شن و این کار برگشت‌پذیر نیست.`;
    }

    confirmDialog.showModal();
  }

  // روزهای تأییدشده را از حافظه پاک می‌کند و هم‌زمان برایشان حرکت محوشدن می‌گذارد.
  async function deleteArchives() {
    if (deletionInProgress || pendingDeleteIds.length === 0) return;
    deletionInProgress = true;
    const idsToDelete = new Set(pendingDeleteIds);
    const shouldDeleteEverything = deleteEverything;
    const entriesToDelete = [...archiveList.querySelectorAll(".archive-entry")].filter(
      (entry) => idsToDelete.has(entry.dataset.archiveId),
    );

    const previousArchives = state.archives;
    const previousSelection = new Set(selectedArchiveIds);
    state.archives = shouldDeleteEverything
      ? []
      : state.archives.filter((archive) => !idsToDelete.has(archive.id));

    if (!(await saveState())) {
      state.archives = previousArchives;
      selectedArchiveIds.clear();
      previousSelection.forEach((id) => selectedArchiveIds.add(id));
      deletionInProgress = false;
      renderArchives();
      return;
    }

    // پس از ذخیرهٔ موفق، روزهای حذف‌شده با حرکت محو از صفحه بیرون می‌روند.
    for (const id of idsToDelete) selectedArchiveIds.delete(id);
    pendingDeleteIds = [];
    deleteEverything = false;
    deletionInProgress = false;
    updateArchiveStatus();
    entriesToDelete.forEach((entry) => entry.classList.add("is-removing"));
    window.setTimeout(() => {
      renderArchives();
    }, 280);
  }

  selectionModeToggle.addEventListener("change", () => {
    if (!selectionModeToggle.checked) {
      selectedArchiveIds.clear();
      selectAllToggle.checked = false;
    }
    updateArchiveStatus();
  });

  selectAllToggle.addEventListener("change", () => {
    selectedArchiveIds.clear();
    if (selectAllToggle.checked) {
      state.archives.forEach((archive) => selectedArchiveIds.add(archive.id));
    }
    archiveList.querySelectorAll(".archive-select-checkbox").forEach((checkbox) => {
      checkbox.checked = selectAllToggle.checked;
    });
    updateArchiveStatus();
  });

  deleteSelectedButton.addEventListener("click", () => {
    openDeleteConfirmation([...selectedArchiveIds], "selected");
  });

  deleteAllButton.addEventListener("click", () => {
    openDeleteConfirmation(
      state.archives.map((archive) => archive.id),
      "all",
    );
  });

  confirmDeleteButton.addEventListener("click", () => {
    confirmDialog.close();
    deleteArchives();
  });

  confirmKeepButton.addEventListener("click", () => {
    confirmDialog.close();
    pendingDeleteIds = [];
    deleteEverything = false;
  });

  confirmDialog.addEventListener("click", (event) => {
    if (event.target === confirmDialog) confirmDialog.close();
  });

  confirmDialog.addEventListener("close", () => {
    // هنگام حذف، شناسه‌ها تا پایان حرکت نگه داشته می‌شوند؛ بستنِ معمولی فقط حالت تأیید را پاک می‌کند.
    // اگر پنجره پیش از رویداد بسته‌شدن دوباره باز شده باشد، تأیید تازه دست‌نخورده می‌ماند.
    if (!deletionInProgress && !confirmDialog.open) {
      pendingDeleteIds = [];
      deleteEverything = false;
    }
  });

  renderArchives();
}

// پیام مهربان خطا یا راهنمای فرم را نشان می‌دهد.
// ورودی: جای پیام و متن؛ خروجی ندارد و پیام را در صفحه نمایان می‌کند.
function showMessage(element, message) {
  element.textContent = message;
  element.hidden = false;
}

// پیام فرم را پاک می‌کند تا نتیجهٔ تازه به‌جای پیام قبلی دیده شود.
function clearMessage(element) {
  element.textContent = "";
  element.hidden = true;
}

// صفحهٔ ورود را آماده می‌کند و کاربر را پس از ورود به برنامه می‌برد.
function initLogin() {
  const form = document.querySelector("#login-form");
  const message = document.querySelector("#auth-message");

  document.querySelector("#forgot-password").addEventListener("click", () => {
    showMessage(message, "بازیابی رمز به‌زودی اضافه می‌شه.");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage(message);
    try {
      await window.dataLayer.login(
        document.querySelector("#login-username").value,
        document.querySelector("#login-password").value,
      );
      window.location.href = "index.html";
    } catch (error) {
      showMessage(message, error.message || "ورود انجام نشد؛ دوباره امتحان کن.");
    }
  });
}

// صفحهٔ ثبت‌نام را آماده می‌کند و پیش از ساخت حساب، همهٔ ورودی‌ها را بررسی می‌کند.
function initRegister() {
  const form = document.querySelector("#register-form");
  const message = document.querySelector("#auth-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage(message);

    const email = document.querySelector("#register-email").value.trim();
    const username = document.querySelector("#register-username").value.trim();
    const password = document.querySelector("#register-password").value;
    const repeatedPassword = document.querySelector("#register-confirm-password").value;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMessage(message, "ایمیلت رو با شکل درست وارد کن.");
      return;
    }
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      showMessage(message, "یوزرنیم باید ۳ تا ۲۰ حرف انگلیسی، عدد یا زیرخط باشه.");
      return;
    }
    if (password.length < 8) {
      showMessage(message, "رمز عبور باید دست‌کم ۸ کاراکتر باشه.");
      return;
    }
    if (password !== repeatedPassword) {
      showMessage(message, "تکرار رمز با رمز اصلی یکی نیست.");
      return;
    }

    try {
      await window.dataLayer.register({ email, username, password });
      window.location.href = "index.html";
    } catch (error) {
      showMessage(message, error.message || "ساخت حساب انجام نشد؛ دوباره امتحان کن.");
    }
  });
}

// آواتارهای آماده را با شکل‌های برداری و رنگ‌های خود برنامه می‌سازد.
function makeAvatar(index) {
  const palettes = [
    ["#7C3AED", "#EC4899"],
    ["#EC4899", "#FB923C"],
    ["#4F46E5", "#7C3AED"],
    ["#FB923C", "#F472B6"],
    ["#8B5CF6", "#38BDF8"],
    ["#DB2777", "#7C3AED"],
    ["#F97316", "#EC4899"],
    ["#6D28D9", "#F59E0B"],
  ];
  const [first, second] = palettes[index];
  const face = index % 2 === 0 ? "#FFE0C2" : "#F8C9B6";
  const hair = index % 3 === 0 ? "#24143F" : "#3A214D";
  const shapes = [
    `<circle cx="128" cy="128" r="120" fill="url(%23g)"/><path d="M37 241c12-48 45-70 91-70s79 22 91 70" fill="${hair}"/><circle cx="128" cy="112" r="48" fill="${face}"/><path d="M80 105c2-48 31-69 57-65 29 4 46 27 44 61-19-4-31-20-39-31-12 21-33 33-62 35" fill="${hair}"/><circle cx="111" cy="115" r="4" fill="#24143F"/><circle cx="145" cy="115" r="4" fill="#24143F"/>`,
    `<circle cx="128" cy="128" r="120" fill="url(%23g)"/><path d="M32 244c17-50 47-73 96-73s79 23 96 73" fill="${hair}"/><circle cx="128" cy="115" r="47" fill="${face}"/><path d="M77 112c-7-40 12-73 48-77 37-4 64 25 54 75-14-4-28-14-38-31-14 18-34 29-64 33" fill="${hair}"/><path d="M105 150c14 10 29 10 44 0" fill="none" stroke="#A64D63" stroke-width="5" stroke-linecap="round"/>`,
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${first}"/><stop offset="1" stop-color="${second}"/></linearGradient></defs>${shapes[index % shapes.length]}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// عکس انتخاب‌شده یا گرفته‌شده را به اندازهٔ کوچک و سبک برای ذخیره آماده می‌کند.
async function compressAvatar(source) {
  const bitmap =
    source instanceof HTMLVideoElement
      ? null
      : await createImageBitmap(source);
  const width = source instanceof HTMLVideoElement ? source.videoWidth : bitmap.width;
  const height = source instanceof HTMLVideoElement ? source.videoHeight : bitmap.height;
  const scale = Math.min(1, 256 / Math.max(width, height));
  const canvas = document.querySelector("#avatar-canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("آماده‌کردن عکس ممکن نشد.");
  context.drawImage(source instanceof HTMLVideoElement ? source : bitmap, 0, 0, canvas.width, canvas.height);
  bitmap?.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("کم‌حجم‌کردن عکس انجام نشد."));
          return;
        }
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(String(reader.result)));
        reader.addEventListener("error", () => reject(new Error("خواندن عکس انجام نشد.")));
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      0.78,
    );
  });
}

// صفحهٔ پروفایل، اطلاعات حساب، عکس، امتیازها و تغییر رمز را مدیریت می‌کند.
function initProfile() {
  const message = document.querySelector("#profile-message");
  const passwordMessage = document.querySelector("#password-message");
  const avatarImage = document.querySelector("#profile-avatar");
  const avatarPicker = document.querySelector("#avatar-picker");
  const cameraPanel = document.querySelector("#camera-panel");
  const video = document.querySelector("#camera-preview");
  let cameraStream = null;

  // دوربین را پس از گرفتن عکس یا بستن بخش دوربین متوقف می‌کند.
  function stopCamera() {
    cameraStream?.getTracks().forEach((track) => track.stop());
    cameraStream = null;
    video.srcObject = null;
    cameraPanel.hidden = true;
  }

  // عکس تازه را از لایهٔ داده ذخیره می‌کند و همان لحظه در پروفایل نشان می‌دهد.
  async function setAvatar(avatar) {
    try {
      window.dataLayer.saveAvatar(avatar);
      avatarImage.src = avatar;
      const chipAvatar = document.querySelector("#profile-chip-avatar");
      if (chipAvatar) chipAvatar.src = avatar;
      document.querySelectorAll(".avatar-option").forEach((button) => {
        button.classList.toggle("is-selected", button.dataset.avatar === avatar);
      });
      clearMessage(message);
    } catch (error) {
      showMessage(message, error.message || "ذخیرهٔ عکس انجام نشد.");
    }
  }

  // یک عدد را نرم از مقدار قبلی تا امتیاز تازه بالا می‌برد.
  function animateScore(element, target) {
    const start = performance.now();
    const duration = 620;
    // در هر فریم، عدد را کمی به مقدار نهایی نزدیک می‌کند.
    function frame(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      element.textContent = toPersianDigits(Math.round(target * eased));
      if (progress < 1) window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  const profile = window.dataLayer.getProfile();
  const stats = window.dataLayer.getProfileStats();
  document.querySelector("#profile-username").textContent = profile.username;
  document.querySelector("#profile-email").textContent = profile.email;
  const joined = new Date(profile.joinedAt);
  document.querySelector("#profile-joined").textContent = Number.isNaN(joined.getTime())
    ? "نامشخص"
    : new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" }).format(joined);

  const defaultAvatar = makeAvatar(0);
  const chosenAvatar = profile.avatar || defaultAvatar;
  avatarImage.src = chosenAvatar;
  for (let index = 0; index < 8; index += 1) {
    const avatar = makeAvatar(index);
    const option = document.createElement("button");
    option.className = `avatar-option${avatar === chosenAvatar ? " is-selected" : ""}`;
    option.type = "button";
    option.dataset.avatar = avatar;
    option.setAttribute("aria-label", `آواتار ${toPersianDigits(index + 1)}`);
    const image = document.createElement("img");
    image.src = avatar;
    image.alt = "";
    option.append(image);
    option.addEventListener("click", () => setAvatar(avatar));
    avatarPicker.append(option);
  }

  animateScore(document.querySelector("#score-total"), stats.score);
  document.querySelector("#completed-total").textContent = toPersianDigits(stats.completedTotal);
  document.querySelector("#today-progress-label").textContent =
    `${toPersianDigits(stats.completedToday)} از ${toPersianDigits(stats.todayTotal)} برنامه`;
  const progress = stats.todayTotal
    ? Math.round((stats.completedToday / stats.todayTotal) * 100)
    : 0;
  document.querySelector("#today-progress-fill").style.width = `${progress}%`;
  document
    .querySelector(".bonus-track")
    .setAttribute("aria-valuenow", String(stats.completedToday));
  document
    .querySelector(".bonus-track")
    .setAttribute("aria-valuemax", String(stats.todayTotal));
  document.querySelector("#today-bonus-hint").textContent =
    stats.currentRound > 1
      ? "بونوس امروز فقط برای دور اول بود."
      : stats.bonusActive
        ? `بونوس امروز رو گرفتی · ${toPersianDigits(stats.bonusAmount)} امتیاز`
        : stats.todayTotal
          ? `${toPersianDigits(stats.todayTotal - stats.completedToday)} برنامه دیگه تا بونوس · ${toPersianDigits(stats.todayTotal * 2)} امتیاز`
          : "برای بونوس امروز، اول یه برنامه بنویس.";

  const historyList = document.querySelector("#score-history");
  for (const entry of stats.scoreHistory.slice(0, 40)) {
    const row = document.createElement("li");
    row.className = "score-history-item";
    const reason = document.createElement("span");
    reason.textContent = entry.reason;
    const amount = document.createElement("span");
    amount.className = "score-history-amount";
    amount.textContent = `${entry.amount > 0 ? "+" : ""}${toPersianDigits(entry.amount)}`;
    const date = document.createElement("time");
    const timestamp = new Date(entry.date);
    date.textContent = Number.isNaN(timestamp.getTime())
      ? ""
      : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(
          timestamp,
        );
    row.append(reason, amount, date);
    historyList.append(row);
  }
  document.querySelector("#score-history-empty").hidden = stats.scoreHistory.length > 0;

  document.querySelector("#avatar-file").addEventListener("change", async (event) => {
    const fileInput = event.currentTarget;
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      await setAvatar(await compressAvatar(file));
    } catch (error) {
      showMessage(message, error.message || "آماده‌کردن عکس انجام نشد.");
    } finally {
      fileInput.value = "";
    }
  });

  document.querySelector("#open-camera").addEventListener("click", async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showMessage(message, "دوربین در این مرورگر در دسترس نیست؛ از گالری یا آواتارها استفاده کن.");
      return;
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      video.srcObject = cameraStream;
      cameraPanel.hidden = false;
      clearMessage(message);
    } catch {
      showMessage(message, "دسترسی به دوربین ممکن نشد؛ می‌تونی از گالری یا آواتارها استفاده کنی.");
    }
  });

  document.querySelector("#capture-photo").addEventListener("click", async () => {
    try {
      if (!video.videoWidth || !video.videoHeight) {
        throw new Error("چند لحظه صبر کن تا تصویر دوربین آماده بشه.");
      }
      await setAvatar(await compressAvatar(video));
      stopCamera();
    } catch (error) {
      showMessage(message, error.message || "گرفتن عکس انجام نشد.");
    }
  });
  document.querySelector("#close-camera").addEventListener("click", stopCamera);
  window.addEventListener("pagehide", stopCamera, { once: true });

  document.querySelector("#password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage(passwordMessage);
    const currentPassword = document.querySelector("#current-password").value;
    const newPassword = document.querySelector("#new-password").value;
    const repeatedPassword = document.querySelector("#repeat-new-password").value;
    if (newPassword.length < 8) {
      showMessage(passwordMessage, "رمز تازه باید دست‌کم ۸ کاراکتر باشه.");
      return;
    }
    if (newPassword !== repeatedPassword) {
      showMessage(passwordMessage, "تکرار رمز تازه با رمز اصلی یکی نیست.");
      return;
    }
    try {
      await window.dataLayer.changePassword(currentPassword, newPassword);
      showMessage(passwordMessage, "رمزت با موفقیت عوض شد.");
      event.currentTarget.reset();
    } catch (error) {
      showMessage(passwordMessage, error.message || "تغییر رمز انجام نشد.");
    }
  });

  document.querySelector("#logout-button").addEventListener("click", () => {
    window.dataLayer.logout();
    window.location.href = "login.html";
  });
}

// هر صفحه را پس از بررسی ورود آماده می‌کند و اطلاعات را فقط از حساب فعال می‌خواند.
async function startApp() {
  const publicPages = ["login", "register"];
  try {
    const user = window.dataLayer.getCurrentUser();
    if (publicPages.includes(page)) {
      if (user) {
        window.location.replace("index.html");
        return;
      }
      if (page === "login") initLogin();
      else initRegister();
      return;
    }

    if (!user) {
      window.location.replace("login.html");
      return;
    }

    if (["home", "add", "archives", "profile"].includes(page)) {
      const savedData = window.dataLayer.getAppData();
      state.tasks = savedData.tasks;
      state.archives = savedData.archives;
      state.currentDay = savedData.currentDay;
      state.currentRound = savedData.currentRound;
      state.isPremium = user.isPremium === true;

      if (page === "home") {
        const chipAvatar = document.querySelector("#profile-chip-avatar");
        const defaultAvatar = makeAvatar(0);
        chipAvatar.src = user.avatar || defaultAvatar;
        document.querySelector("#profile-chip-name").textContent = user.username;
        initHome();
      } else if (page === "add") {
        const editingId = new URLSearchParams(window.location.search).get("edit");
        const roundInfo = window.dataLayer.getRoundInfo();
        if (!editingId && !roundInfo.canCreateRound) {
          const dialog = document.querySelector("#round-limit-dialog");
          document.querySelector("#task-form").hidden = true;
          dialog.showModal();
        } else {
          initAddPage();
        }
      }
      else if (page === "archives") initArchives();
      else initProfile();
    }
  } catch (error) {
    const message =
      document.querySelector("#auth-message") ||
      document.querySelector("#profile-message") ||
      storageNotice;
    if (message) showMessage(message, error.message || "بارگذاری اطلاعات انجام نشد.");
    else console.error("بارگذاری برنامه انجام نشد:", error);
  }
}

startApp();
