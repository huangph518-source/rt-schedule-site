(function () {
  const data = window.SCHEDULE_DATA || { months: [] };
  const state = {
    monthId: data.latestMonthId || (data.months.length ? data.months[data.months.length - 1].id : ""),
    search: "",
    tab: "schedule",
  };

  const el = {
    siteStatus: document.getElementById("siteStatus"),
    monthTitle: document.getElementById("monthTitle"),
    publishMeta: document.getElementById("publishMeta"),
    monthSelect: document.getElementById("monthSelect"),
    personSearch: document.getElementById("personSearch"),
    todayButton: document.getElementById("todayButton"),
    printButton: document.getElementById("printButton"),
    summaryMonth: document.getElementById("summaryMonth"),
    summaryStaff: document.getElementById("summaryStaff"),
    summaryDays: document.getElementById("summaryDays"),
    summaryPublished: document.getElementById("summaryPublished"),
    emptyPanel: document.getElementById("emptyPanel"),
    legend: document.getElementById("legend"),
    scheduleTable: document.getElementById("scheduleTable"),
    personCards: document.getElementById("personCards"),
    coverageGrid: document.getElementById("coverageGrid"),
  };

  const panels = {
    schedule: document.getElementById("schedulePanel"),
    person: document.getElementById("personPanel"),
    coverage: document.getElementById("coveragePanel"),
  };

  const shiftLabels = [
    ["D", "白班", "shift-day"],
    ["E", "小夜", "shift-evening"],
    ["N", "大夜", "shift-night"],
    ["of", "休假", "shift-off"],
    ["vo", "特休", "shift-vo"],
    ["公假", "公假", "shift-off"],
  ];

  function html(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getMonth() {
    return data.months.find((month) => month.id === state.monthId) || data.months[0] || null;
  }

  function todayIso() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  function shiftClass(rawShift) {
    const shift = String(rawShift || "").trim();
    const lower = shift.toLowerCase();
    if (shift === "D") return "shift-day";
    if (shift === "E") return "shift-evening";
    if (shift === "N") return "shift-night";
    if (lower.startsWith("vo") || shift.includes("特休")) return "shift-vo";
    if (["of", "off", "of.", "休", "休假", "公假"].includes(lower) || ["OF", "OFF"].includes(shift)) return "shift-off";
    return shift ? "shift-other" : "shift-empty";
  }

  function shiftBadge(shift) {
    const value = String(shift || "").trim();
    if (!value) return '<span class="muted-dash">-</span>';
    return `<span class="shift-badge ${shiftClass(value)}">${html(value)}</span>`;
  }

  function filteredStaff(month) {
    const keyword = state.search.trim().toLowerCase();
    if (!keyword) return month.staff;
    return month.staff.filter((person) => person.name.toLowerCase().includes(keyword));
  }

  function countPublishedMonths() {
    return data.months.length;
  }

  function setEmptyMode(isEmpty) {
    el.emptyPanel.classList.toggle("is-active", isEmpty);
    Object.values(panels).forEach((panel) => panel.classList.toggle("is-active", !isEmpty && panel.id.startsWith(state.tab)));
    document.querySelector(".tabs").classList.toggle("is-disabled", isEmpty);
    el.personSearch.disabled = isEmpty;
    el.todayButton.disabled = isEmpty;
    el.printButton.disabled = isEmpty;
  }

  function renderMonthOptions() {
    if (!data.months.length) {
      el.monthSelect.innerHTML = '<option value="">尚未公告</option>';
      el.monthSelect.disabled = true;
      return;
    }
    el.monthSelect.disabled = false;
    el.monthSelect.innerHTML = data.months
      .map((month) => `<option value="${html(month.id)}">${html(month.dropdownLabel || month.label)}</option>`)
      .join("");
    el.monthSelect.value = state.monthId;
  }

  function renderHeader(month) {
    if (!month) {
      el.siteStatus.textContent = "尚未公告";
      el.siteStatus.className = "status-pill is-muted";
      el.monthTitle.textContent = "尚未公告正式班表";
      el.publishMeta.textContent = "主管完成審視簽核並公告後，這裡會顯示正式班表。";
      el.summaryMonth.textContent = "-";
      el.summaryStaff.textContent = "-";
      el.summaryDays.textContent = "-";
      el.summaryPublished.textContent = "-";
      return;
    }
    const isConfirmedHistory = month.status === "confirmed";
    el.siteStatus.textContent = isConfirmedHistory ? "歷史確定" : "正式公告";
    el.siteStatus.className = isConfirmedHistory ? "status-pill is-confirmed" : "status-pill";
    el.monthTitle.textContent = month.title || `${month.label} 正式班表`;
    el.publishMeta.textContent = isConfirmedHistory
      ? `${month.label} 已納入今年度確定班表，來源 ${month.sourceWorkbookName || "排班工作台.xlsx"}`
      : `${month.label}，公告 ${formatDateTime(month.publishedAt)}，來源 ${month.sourceWorkbookName || "正式公告班表"}`;
    el.summaryMonth.textContent = month.label;
    el.summaryStaff.textContent = `${month.staff.length} 人`;
    el.summaryDays.textContent = `${month.days.length} 天`;
    el.summaryPublished.textContent = isConfirmedHistory ? "已確定" : formatDateTime(month.publishedAt);
  }

  function renderLegend() {
    el.legend.innerHTML = shiftLabels
      .map(([code, label, className]) => `<span class="legend-chip ${className}"><b>${html(code)}</b>${html(label)}</span>`)
      .join("");
  }

  function renderSchedule(month) {
    const staff = filteredStaff(month);
    if (!staff.length) {
      el.scheduleTable.innerHTML = "";
      return;
    }
    const today = todayIso();
    const head = `
      <thead>
        <tr>
          <th class="name-col">姓名</th>
          ${month.days
            .map((day) => {
              const classes = [
                day.date === today ? "is-today" : "",
                day.isWeekend || day.isHoliday ? "is-holiday" : "",
              ].join(" ");
              return `<th class="${classes}" data-date="${html(day.date)}">
                <span>${day.day}</span>
                <small>${html(day.weekdayLabel || day.weekday)}</small>
              </th>`;
            })
            .join("")}
        </tr>
      </thead>`;

    const body = `
      <tbody>
        ${staff
          .map((person) => {
            const byDate = Object.fromEntries(person.days.map((entry) => [entry.date, entry]));
            return `<tr>
              <th class="name-col" scope="row">
                <span>${html(person.name)}</span>
              </th>
              ${month.days
                .map((day) => {
                  const entry = byDate[day.date] || {};
                  const classes = [
                    day.date === today ? "is-today" : "",
                    day.isWeekend || day.isHoliday ? "is-holiday" : "",
                  ].join(" ");
                  return `<td class="${classes}">
                    <div class="cell-inner">
                      ${shiftBadge(entry.shift)}
                      <span class="unit-text">${html(entry.unit || "")}</span>
                    </div>
                  </td>`;
                })
                .join("")}
            </tr>`;
          })
          .join("")}
      </tbody>`;
    el.scheduleTable.innerHTML = head + body;
  }

  function renderPeople(month) {
    const staff = filteredStaff(month);
    if (!staff.length) {
      el.personCards.innerHTML = '<div class="empty-card">找不到符合姓名的班表。</div>';
      return;
    }
    el.personCards.innerHTML = staff
      .map((person) => {
        const stats = person.stats || {};
        return `<article class="person-card">
          <header>
            <div>
              <h3>${html(person.name)}</h3>
            </div>
            <div class="hour-badge">${html(stats.hours || 0)} 小時</div>
          </header>
          <div class="person-stats">
            <span>D ${html(stats.d || 0)}</span>
            <span>E ${html(stats.e || 0)}</span>
            <span>N ${html(stats.n || 0)}</span>
            <span>休 ${html(stats.offDays || 0)}</span>
            <span>假日上班 ${html(stats.holidayWork || 0)}</span>
          </div>
          <div class="person-days">
            ${person.days
              .map((entry) => `<div class="person-day ${entry.date === todayIso() ? "is-today" : ""}">
                <span class="date">${html(entry.day)}</span>
                ${shiftBadge(entry.shift)}
                <span class="unit-text">${html(entry.unit || "")}</span>
              </div>`)
              .join("")}
          </div>
        </article>`;
      })
      .join("");
  }

  function renderCoverage(month) {
    const coverage = month.coverage && month.coverage.length ? month.coverage : month.days.map((day) => ({ ...day }));
    const today = todayIso();
    el.coverageGrid.innerHTML = coverage
      .map((day) => {
        const holiday = day.isHoliday || day.isWeekend;
        return `<article class="coverage-card ${day.date === today ? "is-today" : ""} ${holiday ? "is-holiday" : ""}">
          <header>
            <strong>${html(day.day)}</strong>
            <span>${html(day.weekdayLabel || day.weekday)}${day.holidayNote ? ` · ${html(day.holidayNote)}` : ""}</span>
          </header>
          <dl>
            <div><dt>D</dt><dd>${html(day.dCount ?? "-")}<small>${html(day.dStaffUnits || "")}</small></dd></div>
            <div><dt>E</dt><dd>${html(day.eCount ?? "-")}<small>${html(day.eStaff || "")}</small></dd></div>
            <div><dt>N</dt><dd>${html(day.nCount ?? "-")}<small>${html(day.nStaff || "")}</small></dd></div>
          </dl>
        </article>`;
      })
      .join("");
  }

  function render() {
    const month = getMonth();
    renderMonthOptions();
    renderHeader(month);
    renderLegend();
    if (!month || !countPublishedMonths()) {
      setEmptyMode(true);
      return;
    }
    setEmptyMode(false);
    renderSchedule(month);
    renderPeople(month);
    renderCoverage(month);
  }

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab;
      document.querySelectorAll(".tab").forEach((item) => item.classList.toggle("is-active", item === button));
      Object.entries(panels).forEach(([key, panel]) => panel.classList.toggle("is-active", key === state.tab));
    });
  });

  el.monthSelect.addEventListener("change", () => {
    state.monthId = el.monthSelect.value;
    render();
  });

  el.personSearch.addEventListener("input", () => {
    state.search = el.personSearch.value;
    render();
  });

  el.todayButton.addEventListener("click", () => {
    const today = todayIso();
    const match = data.months.find((month) => month.days.some((day) => day.date === today));
    if (match) state.monthId = match.id;
    render();
    const todayCell = document.querySelector(".is-today");
    if (todayCell) todayCell.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  });

  el.printButton.addEventListener("click", () => window.print());

  render();
})();
