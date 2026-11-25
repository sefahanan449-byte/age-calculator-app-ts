type Field = "day" | "month" | "year";

interface Age {
  years: number;
  months: number;
  days: number;
}

const MIN_YEAR = 1900;


function getEl<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

const form = getEl<HTMLFormElement>("#age-form");

const inputs: Record<Field, HTMLInputElement> = {
  day: getEl<HTMLInputElement>("#day"),
  month: getEl<HTMLInputElement>("#month"),
  year: getEl<HTMLInputElement>("#year"),
};

const errorEls: Record<Field, HTMLElement> = {
  day: getEl("#day-error"),
  month: getEl("#month-error"),
  year: getEl("#year-error"),
};

const fieldEls: Record<Field, HTMLElement> = {
  day: getEl('[data-field="day"]'),
  month: getEl('[data-field="month"]'),
  year: getEl('[data-field="year"]'),
};

const resultEls: Record<keyof Age, HTMLElement> = {
  years: getEl("#years"),
  months: getEl("#months"),
  days: getEl("#days"),
};

const FIELDS: Field[] = ["day", "month", "year"];


function showError(field: Field, message = ""): void {
  fieldEls[field].classList.add("invalid");
  inputs[field].setAttribute("aria-invalid", "true");
  errorEls[field].textContent = message;
}

function clearErrors(): void {
  for (const field of FIELDS) {
    fieldEls[field].classList.remove("invalid");
    inputs[field].removeAttribute("aria-invalid");
    errorEls[field].textContent = "";
  }
}

function resetResults(): void {
  cancelAnimations();
  for (const key of Object.keys(resultEls) as (keyof Age)[]) {
    resultEls[key].textContent = "--";
  }
}



interface ParsedDate {
  day: number;
  month: number;
  year: number;
}

function daysInMonth(year: number, monthIndex: number): number {
  // Day 0 of the next month = last day of this month
  return new Date(year, monthIndex + 1, 0).getDate();
}

function validate(): ParsedDate | null {
  clearErrors();

  const raw: Record<Field, string> = {
    day: inputs.day.value.trim(),
    month: inputs.month.value.trim(),
    year: inputs.year.value.trim(),
  };

  const errors: Partial<Record<Field, string>> = {};

  // 1. Empty / not a number
  for (const field of FIELDS) {
    if (raw[field] === "") {
      errors[field] = "This field is required";
    } else if (!/^\d+$/.test(raw[field])) {
      errors[field] = "Numbers only";
    }
  }

  const day = Number(raw.day);
  const month = Number(raw.month);
  const year = Number(raw.year);
  const now = new Date();

  // 2. Range checks
  if (!errors.day && (day < 1 || day > 31)) {
    errors.day = "Must be a valid day";
  }
  if (!errors.month && (month < 1 || month > 12)) {
    errors.month = "Must be a valid month";
  }
  if (!errors.year) {
    if (year > now.getFullYear()) errors.year = "Must be in the past";
    else if (year < MIN_YEAR) errors.year = "Must be a valid year";
  }

  // 3. Whole-date checks (only when each field is fine on its own)
  if (Object.keys(errors).length === 0) {
    const exists = day <= daysInMonth(year, month - 1);

    if (!exists) {
      // e.g. 31/04/1991
      errors.day = "Must be a valid date";
      errors.month = "";
      errors.year = "";
    } else {
      const birth = new Date(year, month - 1, day);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (birth > todayStart) {
        errors.day = "";
        errors.month = "";
        errors.year = "Must be in the past";
      }
    }
  }

  const failedFields = Object.keys(errors) as Field[];
  if (failedFields.length > 0) {
    for (const field of failedFields) {
      showError(field, errors[field] ?? "");
    }
    // Send focus to the first field with a problem
    inputs[failedFields[0]].focus();
    return null;
  }

  return { day, month, year };
}

function calculateAge({ day, month, year }: ParsedDate, now = new Date()): Age {
  // Whole months between the birth date and today
  let totalMonths =
    (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
  if (now.getDate() < day) totalMonths--;

  // The date after adding those whole months to the birth date
  const anchorIndex = month - 1 + totalMonths;
  const anchorYear = year + Math.floor(anchorIndex / 12);
  const anchorMonth = anchorIndex % 12;
  const anchorDay = Math.min(day, daysInMonth(anchorYear, anchorMonth));

  // Days left over (UTC avoids daylight-saving problems)
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(anchorYear, anchorMonth, anchorDay)) /
      msPerDay
  );

  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days,
  };
}


const frameIds = new Map<HTMLElement, number>();

function cancelAnimations(): void {
  frameIds.forEach((id) => cancelAnimationFrame(id));
  frameIds.clear();
}

function animateNumber(el: HTMLElement, target: number, duration = 900): void {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || target === 0) {
    el.textContent = String(target);
    return;
  }

  const startTime = performance.now();

  const step = (time: number): void => {
    const progress = Math.min((time - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out
    el.textContent = String(Math.round(target * eased));

    if (progress < 1) {
      frameIds.set(el, requestAnimationFrame(step));
    } else {
      frameIds.delete(el);
    }
  };

  frameIds.set(el, requestAnimationFrame(step));
}

form.addEventListener("submit", (event: SubmitEvent) => {
  event.preventDefault();

  const date = validate();
  if (!date) {
    resetResults();
    return;
  }

  const age = calculateAge(date);
  cancelAnimations();
  animateNumber(resultEls.years, age.years);
  animateNumber(resultEls.months, age.months);
  animateNumber(resultEls.days, age.days);
});


for (const field of FIELDS) {
  inputs[field].addEventListener("input", () => {
    inputs[field].value = inputs[field].value.replace(/\D/g, "");
  });
}