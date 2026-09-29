// app/report/dar-form-template.ts
//
// Builds print-ready HTML that replicates the official Allied Universal
// "Daily Activity Report" paper form, filled in with data from
// dar_submissions. Each DARRecord becomes one (or more, if the activity
// log overflows 18 rows) physical pages, matching the layout/field
// positions of the printed form so supervisors can print directly from
// the website instead of using the paper version.

export interface ActivityEntry {
  from: string;
  to: string;
  activity: string;
}

export interface DARRecord {
  id: string;
  officer_name: string;
  client_site: string;
  branch: string;
  date: string;
  scheduled_shift: string;
  shift_start: string;
  shift_end: string;
  meal_break_out: string;
  meal_break_in: string;
  rest_break_1_out: string;
  rest_break_1_in: string;
  rest_break_2_out: string;
  rest_break_2_in: string;
  on_duty_meal: boolean;
  received_radio: boolean;
  received_pager: boolean;
  received_keys: boolean;
  received_detex: boolean;
  received_other: string;
  activity_log: ActivityEntry[];
  missed_rest_break: boolean;
  missed_meal_period: boolean;
  missed_explanation: string;
  signature: string;
  submitted_at: string;
}

const ROWS_PER_PAGE = 18;

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y}`;
}

// Formats the record's original submission timestamp, e.g.
// "Submitted 7/14/2026 2:41 PM" — a fixed value from submitted_at,
// not the moment the PDF happens to be printed.
function formatSubmittedStamp(iso?: string): string {
  if (!iso) return "";
  const when = new Date(iso);
  if (isNaN(when.getTime())) return "";
  const datePart = when.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
  const timePart = when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `Submitted ${datePart} ${timePart}`;
}

// Accepts "HH:MM" (24hr, from <input type="time">), "H:MM AM/PM",
// or an already-formatted string. Returns the time portion (12hr where
// possible) and an AM/PM flag for the circle.
function splitTime12(raw?: string): { time: string; ampm: "AM" | "PM" | "" } {
  if (!raw) return { time: "", ampm: "" };
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "\u2014") return { time: "", ampm: "" };

  const ampmMatch = trimmed.match(/\b(am|pm)\b/i);
  if (ampmMatch) {
    const ampm = ampmMatch[0].toUpperCase() as "AM" | "PM";
    const time = trimmed.replace(/\s*\b(am|pm)\b/i, "").trim();
    return { time, ampm };
  }

  const m = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2];
    const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return { time: `${h}:${min}`, ampm };
  }

  return { time: trimmed, ampm: "" };
}

function ampmField(raw?: string): string {
  const { time, ampm } = splitTime12(raw);
  const amCls = ampm === "AM" ? "sel" : "";
  const pmCls = ampm === "PM" ? "sel" : "";
  return (
    `<span class="line w55">${esc(time)}</span>` +
    `<span class="ampm"><span class="${amCls}">AM</span> / <span class="${pmCls}">PM</span></span>`
  );
}

function checkbox(checked: boolean): string {
  return `<span class="checkbox${checked ? " checked" : ""}"></span>`;
}

function mark(checked: boolean): string {
  return checked ? "X" : "";
}

// Official Allied Universal logo, extracted from company materials and
// converted to print-optimized grayscale. Embedded as base64 so the print
// window renders it immediately with no network dependency.
const LOGO_IMG = `<img class="logo-img" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAjAAAABuCAAAAAAcgXYdAAA43UlEQVR42u29WXckyZUm9t1r5lt4eKxAYEkksrKySFaT7J4ZjY509CA96T/rQTrSk55aZ2Z6mmQ3ydpyA5DYYvHd3cyuHjwABJasyipmVbGbsJdMhEe4u5l9du3e7y5Ggo/R5E//+PtXhRUSYeXP/uF/+S3+bTT31f/3//zjMZitiT//3//X38QA8PL//D9+v2SIcPLpf/7f/qchHtt144818MZcQ09ca83j0D4C5luaNW0rAAQOsHVVPwLmETDf1kyZlw0gIgDaMs/Lx6H999n0x7lNW+WlA9z6r6KoH4f2UcJ8S2uqsraOAAEBtq1qeRzbR8C8v9VVs6G1iGmq9nFs/701+XhbkpRl64QAgYgDbFXW/uMI/3tqVdGYYOh/JMDUVeuIOggKgaR9lDA/bzPGCUh/rFUrq4tFZpLZKP44gGnKyl7JLACwdd3cs6MqC5AOgwcfWdXGCOD5kX5Yqa6cgDgMvc17FrUFrf8gQAAhL4o23stY6S4KSHvBXzKAbVa0Firs9dav2KZFI9BhL97Y2JusaATkR3F49VGR18aC/F7fv3mxsjaADntX/TVF2Voh2hhFIR1tdAZVXhoQCAIBeV4YvWf2zGqV5o0hHQ2HY+/Bb6RlKwBI+70e3bnosrJtBMrrDa86dvnm5Dy3g9Wk93EAUxSVpQ4xBIHYqqjdLfWomZ+vKoGKBuPxA7OWzxdpY6GC4XT0wOVqMV/WFhQOpqPwpteXZ8sajJsOC1mOprvx+s90uUhbAbpXIy/sJcP4B6/Zizfvcgcvmcy2egBgTl9dFA7eeGc2ve5rcX5ynjlwPN2dJuu+nR1f5g4cT/a2108vzy7OslYkGu/Oxt1H85PztLVqoy9ivWg0u+4MirPji9JpgJ0I2I+SwWjQe0AaLM6Pzs5XZc1+Mtl7uv8QUX366rIUAOQl2/uTO78/P75IaweOdw63uo7lp69fnZdI8rPwowDG1WXjbg1uVTa3AZOdvX6XCVQyM97k/mQsT07OCwsV78K7DxhJz45OUwuKZ867AUx58c1xCYX1XgiCwGLwPIy6R7vV8fG8NAwQxEFpr5dMt6Y/kOkv3/3rFwuBN9z/VJ4ygOL4918V4qK9X6gwuRbdR398uTTg0WGr1wIgP/nim0tHKjloeC1eV0dfvrpsxcWHLk40ADSnf355WZlNwFjxBgdNeA2Y9O0fX62sB5CIgHXYH05m27PRHQFRHL98++b8Iq0b9uPB3rNffLJ/z7LJX/23NzkDToXjZ6p/e8Tr0y9eXeQOGH8W9nsA4NL5xXzeKsjC+ziAabLcdCZ1p8aYMq9uIcgVZ69fLQE1qPzB6F4H2tXpNyeZFTVo48Hw3mVTnL9+s3QOSd0bDK9fuTx/+XVByjEcAw5MQq3bDmbb3Qg06btXJ5llB4YDFMgLt3YPD7e9H6T1nf7xv50z6eSgDCYJgPLoX/45ZRc/8ybb13txdvLFH84NaJpH46led+71P78zpAZzlYwGANBcfvP7L85amFG1syas6ssv/+WkMIrkev6tC6a5t7VztQGujv/8+wvxpBtkIhWF491nn714cgsxq6/+5Q8vz/OsNoDS/vjr40vz7O6ms/j6v3xRMwDlbWXD/duAKU+/+ONJKrBbbn+/BwBllreOtaaq/DhKr9RVbdyV5SWEtuyUGtwoNfn5acqCMs4bew8RrlpdnBQQVEneuvumflvM360gUvbz1m0oFefvSlYWkDUDpKg17aw0/vqu6cVp6hhOBATlAH16njbm4IeQCW16/HJOiqPS3/00AVCvjl7l2ob6MLumFKRavHtzJnBF8rxcvymZxdFbpyTh2ZMnAwBoFyevXp6LmGynVXqtN5wdvSmMIrmiP5UVLw12S6OvhnD17s2ZeOLgADCYdX/6dtF4O5uw/vqf/uu/nuTGdNoOLi9WlRft3OnL6vjrr40HC6XT3i/L2zLXZOdHbwqIKZ+sO9bUrVMBe9w07UcBjG3KynR4IYYITJXX7jYkTJUb7aSszAOUnpO2LFrtTFa17kEFoswbhsuLZvPXtsysL8YyUSdDhGHS8voJ0pR5A4gARBA4aZuqrI2/+4PEaJ5WHmzr4hfL3Q7GuSGTZ5W90VOlzZYVsUnz+mrFRBHXNYldXJ4vqu690/PzRQOyhvy1UutcWxa1a0m6iQZErOTFhlPOmjJtyLm1Fk8AymyeNT7Nbt7y5Hf/+Pvj3ELEgQmoTlv0+3p6W1imi0XOgIWrcbZ+qZvl79oybxhtXrSyJuvEUeAFcJX7WDpMN9HEDAhg6/KO+5GJCWADYqL79OHNZ8T3lz8RwTkNQ5vfBBGo02jBDIYo5Tul1fVXiAGAnYCZAChYmzZGD+Lk+3eSiJiUFpNdnM5bD1CsfSgBKb55e2JWpEFEfKWP9EeDWENZqdK8WsM/LR0RU380Wr8Js6d0K4TrAdLC7HtaXQ0HKyZNpI0jYgIgJChKy0kUXXdn/vXvf/+qIXU1MUx28XrQC6NbynGZlcKsnWOGqco7gFGsmVnDqqsu+JGvNXwPodUfS8J0Rpqn2UkLkruAIVLEgAM9BAgQKSY4gOgBOIGVIoZjEN+6TsSAWAFpJkAUM4f9yOOb2esMJO177NrWQiDlabIzCb0fABitFBGcyy7OV1NAaa1bIuhNuCulFDMUa331qTccJ1HTSaRGCEBb5rUDKBqMBmsdnrT2GQA7Zs0EgIS8KIq8jaWkmBTAvu9padtaHFu5+GYymlwBpj15+fI4Z+2U5/nalBWIsfyqP927DZiiESaAiY2py6q9NRqktFbdP+tnh/1+XDUE7kUfR4dpik5lCbTHprHCaMt77kdyxsER08PTAbJOLL/vsmIxcHc8GcRwBhbK7/maAYBC2tq+JpeYGc7BsT9KdFOkZS0aaC6Pt5PtH+BFYbYEOKkWx6cDD8yaLIymu8ByBpYVXb9rfzyOKmPRZmltNYA6yytnBcFoGPGNYBXrSMTv9XwCBBbB1t74hiljIhZDzouGo9DVy2XmRMjNv5o83VubUoujV2clIM7vT0dBfnpWESlz9uWTzzctJZcvKxHXiGOxrs6z5hZghABYkLueDEomqSuMDePA/yiAaeuqBTvWka8MjJDYuqruu60EeA8gAGZ0qsZ7AKO6y3RncgBHHI2nox47iMB6k8MbOwqkwA5qsL8Tmfz07LKCcigvTmfj799xVgoiDmQXxyf7QyhWCgLF6vabEhzAfGMhh8mwn7ZgUxaVAEBdFg0gHI1G0ea2CxC88ZOdvgKMEwknB08HGz1WRALyhoeHI6969/LowpCi+vj1SbYGTH56mgsTvMEnnz3xLr7Aac1w6dHr03RDsW3yogKJiCMHmLqo4rujDTjGzV4QbbVBVptw1A8+CmDqsmzBYD+KVWOalqxryrLxb4sQ0HfPyfebQQgIDD/ZfX441EYgENUbjW8/lyUYPXsxlvLoiz+ftQ6ump8tmu/f8WvN1szfvP10CCYSAA7y8Neum5eMB+cl0BZZbTxA8jStDAv3hreJNyFCuPMfPp9pWAOB7g2nm51xAAHe9NPfPh24V//9v9qFEVQ4vUh3rpipy9wKUbD96//5F+rtEPaiBVDni03AtOmiaDoBLRBTpNn0rlJ6tytjHuWtCZLeR+FhXFXVVoiUF8W6rAoDiKnL1r+/73y7liAPDffmWD0whUTk9bee/XKq1yq95ttfIRD3dw63dTPFMjUCctmq+CERgdLFFMKmx8crXC9A9/B3bz5W4bAfEMGUed5EQF1mZQvA640S/+YHIgTAn/7if3yiRZpOEw7obm+gk71PP9vGLq/S0jmFpszybnFKXXa2fDD95f9wiLErijZV2o17qG/4HbRFmrdyPehlVjT+t64QgMdJa5wO9EfRYZqqai2zVV4v0ZQzANi2qeMHTQ16j2hxP+zhxJY4TCYa79Fj2YG8qO8jfHr59XFlBbbJqx8cQiqiJDs9uXRMmj5QEvYGg1AJbJHl1RCos6KxCqTj4SC4Ow4qnO4kAOL39NZBefFoDOw/Ozy6rB3ItWXRxQaIaVrDwipItveB7U+WqbnUoTd5OtCbgMlWRQtHcEwgW66WHxBacGUefRTA1LUTOJAf9ZX1FMBWmjvWmlyvo/cIkB8s33Bft7m/SBwATpJQW8A2TWv/gqc5szg7X45pQ0359rHuDYc+EVxTZjmAMi9bAUT1x4n/gKqkv/MVrAAYz6bxwghI6pvYgI7Vo05f3Pok1xeq1x8/3d30MNZZmpuO5yTAFYu0+fAB+BiAqbtgO7AfRLrRRCwkTbVprQmcODCstQ8hRmS9en6kZttWCPCCkAHAWfOXPEpss7y4GEN/IGAQD5MAAtgqL4SkyCpHcKLCpP8DvBRimqb1gGAwDDreRq6i15g1sYVr83SxDSRPMVpx1B+Mxwlt8uZZbcGkBM5RW6ZF+5MCRsrCgAlQXtTz6kAxKdgmKzbNe4FAaedErDysHjAzmfcrMe+TIEIgAvO3byNrlCrNAsAa+4MjSAUQmPTkeGaVAtOHaOq9YeKrFnB1nlWRKdLOVat6w+ShHn3r09lCrAMA9jzd+WLsOquHvCj2CA7l/M3rXgy9E+3V7Hmhf0sVKtO0EoIfKFO20uSrtPpJAdOWZeWIAGE/8kLtnHIwZVaa2+qudBS4PEiKOesgsh6K79vUe7ekKwnTAcResQzyl0QcC9iVp0dP4k2K91tbNIwDCAiuzKuoKYrKAeAgTqKHGYTvUtveg1EKh0kAwFVnX+7Fv2BgMHjIzZLlNRjByCtN5VydZj+thKnyrDSkYBwHfb/QDGEndV5uatlaKd0QK62Y7w+IVqwYAoBB90fDOeH12uOHNWaxH9KRDZz8Zbuf5Mevnu5YMAnEfSdfoJNh5FcA2jwtkipLKwuwFw0G0QNr57vV/I4KRlubzq7kK4wl21vJqQHM4ot+Lzp8jwaRpVkrWsVbUdoU4qo0rX9aCZOnpbByEBX1g9RncYBybXtLk/N7PSiHJA4e2PmZladJLBTph1fPlWB6aKKdqbP5lGohZv0eVrCbB/kIWpIjgZTnb4/DGorNB8mqXtwPFOBMkVVNnWW1FafDJHko/KlJL7V1ZKHew6qyUloBKFdpJQSxTvvrzT/e3R/7NSDFUdiL1ZMHf1/kRWUU+f2txJ+zcJ3m1y7xnwQwpsxq1+kwvcTvR4FySgUeuc3Z0dFoOwdoMI4f0PNEB1GvsXBB8BBglII4Ylh5wMoSseXirbrkRkj5ycj7MBHzl2xJQD0/Pk5KYf6wW4b9pJe2gjZPS9PkaW1FVDRIwvsWUDN/mZw65wxHw+mAHmSyOvhfnpxmFgRhP1pb58ne0604A4tbvlKeMfsPDUaRVQZgL9keIVIGbZGV7U8JGGlaCoWdivtxFPSHg8pqL+73/A3AOE52kcPpZHcUPHCLIJmWurYYJuGDvkmCgBmw9h4EyDXZKS37ZB1zMsO3eImIiAgfo7Xp2VGS18zO4QMU9TAZJvNW0BRZ2dZZWjlHKhklwR00CEl9+vtsCCeNGj15wcldqDqIrdLl5QTHX748TS1Ayo/7V1vb7PCTl0UBglt8ibpunt0325ssqwTEfrw1qUNlnZRpVkU/IWCYdU+JBo3GPU/3RvuB9bw4mgRtq40QhLQ0qr/TrxxUNB77cm/SnD+p/UXVSjzx0XoPsEbUrasHgiPEtcVlexmQADyoRtOPVV/g29wXUqeniflg+oKjJAkLwJR5bda+ai8Z9fVDEubLeUQODU+L/vihMIx2dfTnauBe//NXZ41AxBsMk6s+e3sv3uSvKyhr5l+3pm0+uUcA1l2Yi/L6w/HKZ8DV1fdIVP0YPIzXry089kdbARBs2S0o3/OjuFkocZ2/3nISOUtgHYTeAzpMtOWNi6qx3ihC4SuCuooj6pofBBURdcrxjTZBBAeRWmqtCQoS60/Mj5YQ5TqOUEOsRf4uQOZIPswBFg1GoXLKlVlelWneMpM/mMR3X1VIbGrmmkAtpvFheXttEQSE+vxP2ZeBOX31OrWA87f3Zje20OzzZZGdGdLGzU2bpeWL8V0bJV1WFuCwP5nOQ63EmjLLHP9kgDFtMGTH2gt6faqs7e1MoDUrrV2pOpvHQfkRkyKSh3cELw7ipq2bRrzQ5CV1uRSkQGCt0DSIBlagoii4b8k6oLakQBqmnuT2xxUwFAS6LYyrL5mXVykJ363EDAcRMaTKsiLLKwdQkAz7D4y+a00OKGWsOU/ru+MlgLQLexlSm62yliAqOfh070aM8GGRruzcOSK7NE3rzK/uIKZO80oAFSTDURJpErg6S+voJwCMMdY41BklAZFSnq+b1BOOIsWKGSAmpVlpVppuKW33Z8H3I2vatm2tNOKcQKxxIAIp7ZErbX+qjbFx3+cbA5qZIBDpDBcCQZrWyI+6G7H1x2EprWvmtW5K+8GAGcca5JpsMV+uSgNifzDq38sIUoBj69iJbYuydZsL3139U5hco20bCwJFe7/6fDOKe/BZVdMXF5bYSXZkTY1f3s7SqJbL2gpUmAwHST8sHVyTptWPChjnxDrTmta01raNCwMGg5WtbUuKFCtmZoL2tNb6w4QdCVhZDSvOGOusqYzpDG6fyZhoFre17SXa3A1MIIIi0oqISQWhph9RvDA5CreGaVs1JquUc/YDKZ1wOOppwNX55elZWluAgv649xDJAiaPSLcU+d5dToogBEfGKVgnJFDR3q/+/pezze9MPjcEXDiAuDoyLcmvh7d4+dWqtoBOxsN+EkdpC2nTtBz/WIBp29q0rXXGGmedsc7azoAhdEav04CIY9KstKc+EC9tU7fGuo62ZePIMiBiwVSREuuP49YYP0a+qAPd0S1dNK9jsO8HWgkh7I9j9aNuSIxoOlulqXGNIciHojOIBxEDzuSXJ/O0EQBev/8QzwsvDDWRqjHa6vv0HirIQByRhb/z+X/89dPbVsLs1wT/y/NKiKQ+I0+Ff7dhvkudZQ2AYDQaJsmwf+kc6jz94Ho+3wcwYkxTN3XZ1JUxIiASESfExACTYtJaMTPBgUHEBLFd+JZzohgCeo+/rkpXRdU6BGEv1ITWGlub1honzsHBQrF2Vjh0paoC3w/CtduFwI6CXr/vawEo2Uv0jwcXB4CC0X6yXLWViED4AzdAPRz0NIm0+alerVoH6DC5T8MwwP3pOGLHtRofbt3KYuUrKac1Q1oHJgkPfvPb53cNoV3lJfEfjzOx4OadIOp/4m2wZqu8YVJBL9ako4hFpFkuPpi60x8uWNrWVG1TN1VbtdYCihQBBEVMJKQsyDKTWOKr3okhIQs4Y4yzxgj7fvRAgrPLT0/nuQH1p7O478E6a40znRxz1lR1XVsBsThTi7MWyrvekMiLprNprKxjTnZHP7JVTao/7l1cFLUQfQ/euJf0NACbn0uWGsfwwv69pGYQSzB58UlCFq0eHO7GD3kOdK/fU9VqadkhmBwc3HcXbete6Huvi5aI2lNvvBUdbHj+srwFg9BmLhdSgKvytHQfU8K0TV4WZdG0rTHONsY6JoJhBpNiq1xnDTlLBGGACQYijjQrIVEQMsUiLSrLvfH2A7nVLjt/+S61oKFJeB0XLeKcc2KstFU6X80rIR0OIu17LLbxNMk67lP5yezFwVA3Qhwkox8LKSJdnAn7ySi9XOWNfB/Pen8Yh9qIKU7LOjWAjpJB/x6FTCB/++9/O4WBUdFocu8bBHbeaHcnWL6qC5DQtVfgVhv7Qa8fvL60lq09/dM4Tq7VmCpL8xaENj177R8vWhFInX5EwDSmrYsyL7KirFsrpMRaKMWKxAFgR4qUIhApFnGOncCCQKQDn7RSqtuy8nfH88rwYF89oOq5av7uVc5O0t6+3CSJXJPZlFYXS8d+rEZhHAJQJLTWNllUNN5/MeYGDNb40RuFycHZyal8L9LYj5NIW+eqZWkqAXR/0AsessP84bPfzJwlAQcPkd6OvMmnnyan5qwAweaLxfYDX4t/FUZK2aUBoXr7h+2nN4DJ88oQXHH2ZeVdHmUNCG2eVvajAMbUaV6UVd7UZVm1roskdwLFihSzEEPEeUoxAVqR9jSLscZaY+H3RoEfdklZkPz01WVtaay32ofIh3K5qLS09sE37wWuuFg45lFsg2HA1pHH1x5JYh0kY43we8z5+xwH11hleo/4ECveGO/+rJzqbLsPbHGSRMbC5qVzAPxk8HCpFY6G02+nHr3x4W/Hby+/XgHUXL59uvtQdQH9XLO2X6SiyF2++uZ0/2qZFmlZOwWXv5MzKk+XDQBT5GUTPyRU5fsAxjRllq4WaVY3zrqmhSbVUUfOMinWyuuYeuVpOCFSvh9qqaqiqKq6gT+mYbieAmWzi7O5OEeTh+KvZV221bWNeSja1jVlkYEEU+dF/o2N2aX+OzD9UNvoJjyHb9wO74m97AJ64NQgPBp63zPWKxqOerkl1woYxNFo9HB1l++gAhlW97aezoIvx+c1UJ99c/D8DmCMI8XgZxpF8SZ37KrLdyeLNWDKNK+dY9jyrDiGKctWFNqqs5w+xFP7XsDkWZ7nabrK8roVAM4RFGAZROuaLERMpLTne+xgxKkoTlTVlPN5Vlc1+03srgk7U+d5zWKbtrUPGaOklHTZXPIAS23asmy12LKy5D0Mtw9xCPADkUfuZlxY6w53/o334gFi2SCKtgb+91SuvXjQn7eAWAaBo0HyMFUmbV1+u6xkFfQG5XTcMxbm8u3R8taWUJWl0cEoITwpzy8LU4NdtbiYr0tWVHnZhae2tmLAGgEg1YfXyX0YMKZczefzVVHUZW2kC+oR6nZtpTrulrT2fFbsKwVrGuOCyB+PaDnPT0/T2rTKk1F5M8ptWwPExjh7P9hJQMQWDuswqntzZIyBg5hbEXm8li8QJ9+5Ba9RKnfRytcby03sBEGMMARQfDtwlyysFR1NJsN5+4Es75qJ6Y+ToHKdHS46Go+j95Cijfl2094aK4gm24OiYZednS2ra4Ctzi7TNDXh9GB/COz/6mKZ1YCYcr4sO8AUy8x0JDwL4DoXjGnyLH3IrqYPA0xVrJaL8/k8r4xthTSpLq7RrIWLYmbNrILQ18RwtTF1ZRFHqk8IUM3PUkOOtLcsrqSFE3EEBWGtHwxBVFrBCfzA8+4vXevEwTEc4ORBsuw7FNAu9xoa7q4xoJhpvS2Jqco26qzCVsAOAGl9hzoWMZb9/mQUZ98rVUX1h30PQJcrzL3B4H1y5LtCNKUtCkfJ9uiyANp8ucyv7lQe//nVokhN76lLhkDv2cXR67ljVqZIqwEASJEVhrhzoio4wxYQmCrLynuecfKC8AMAU67O55fzdFXkjYUIyHLnPAYUMWulmZVixWHU7wVSF0WRV2Uj3jARD/CVa7ICDJgiLZrwWoQwnIWwvh2QfINlAkhIe96DV5nWKYbuzo5F3bT6344Xta4YY6QTklpd+xI9hmV24mx5frYYAGjOLvN19RLlhZ66u4dZx/Fs77QydK3ZfICZlIwGPrqXF6jeQ+GZAMBe+B3au7NtY4LpzvQtHEu1OJ9P1iNanfzTH5dt6eIsPDgAMHu2E0FAJHXV6ShtvshaIRDrwNOwbVddRdoivQ8YtVku8H2AKZcX5ycX87SsnRNiAGLtWiNUpLTnacXK057n9eLhIGwuLs6WWVE0KqLCdooAiQNDbFWWV4AhYmYxkPelEEkXji/uoQlQSjGLhb2uTnZ3W/munMpuX8m7qjXM3k3ViigOVWeg2/Toq0m4bdN3X7xJjTjAsYr6d3VTsc4g3nny5kJEfXhmDMfr8BfHAFQ4HD6M8e+K8WIrzhkXTnanAQTUpqen22u1t7346g+Zam0sW5eOAR36iu1mNlhbrPLGCSndH/Y9uDqdFw5MNl8VP0SHqRbnp6fn58uidpaYiK+jUghaaU1ESintR1EUBr04HoT55fLdvKzalu2w2y680NeAY3FtVVaDjU2ji9xviirEfS9M1yPbVuUDeZvUKZ/v0zNtW+bJt5NuAiC9WOSNEMj3b/a9XhJrJohAsrf90Oy6yzd/+Ca1cNpCqD+4k2tGEBHEu/sj7/v5xeNNO1pF77GqIU2ZRlduiIcXgnMCDGejEAC5/N3JwRow1Kwuax924R0dX2wDRVraztzhtUvP5FneCOANnxzuhILs6Ku3JRy5Is3uBa7ZNk8ndJUq+ABg2vnZ0cnpxSptHJPAEkiYuwBqUtrzGUp5vu9HgySJozD0PZjm4iR11ogz65cKokiLVU5sXZflHUSIyS+PKWaxEFJ+GN3lY4rLExezE3dLIso6t5oeEEwkrlydJiPlBA6A8tfpajc/kDpdMIqTl2eFgWLdG97UAYzG42GvZgtIcQxzuU3z19+8zQXiCIjGs1vMu7ATOIGe7W9FBP4eWm9v1IWfMkDw+4PkYZW2Sd9+VbDAAMLM0YOCSBjhdBrpBmKyk7cv1jXYgqgXtgDM6ujLp+gV518cFY4glqM1S2iKVWEFFM5+9Z+eR5bTP0naGiJbLNLbRT/gYBZvpktFzkDI6609XxuAmV8cHx2dzrO2AWm1zi6VLqeRlWIQsxf2o17UHyRJ3MW02+xyUSsnQjroqvR4YeiRGIJzpm5udG8CBK5eHLlVpK1AyO+PJ8ktu1/axRHmoXZOhLxkchOiyO/TFkRsU5xF7bD7kZDfH42HGwLBimtXR/4FsqOvLytRYoNkuCE2hlvb74wRKGlTaS+GnJ2dpeuzfHR/uj3cdFVfBeFguDOJWSDA/RCEtUy8S8TE/VCvQyF1FD/kqhZhtOd/wpbfZVIpRJPDfbpz7/UDB8N+aADk52fpOsownOztmBZK6rMvhlm/PPrDNxnYGdbDdV0RW2alBVQ0+/Q3vwgcFd7rr5cWYoriDmPqSKqzP9kthrTk0Ns+2PVvAcadvnr9+vQ8bQwcyKhuPwIgljR7WhGTF/aS0WAQ927qDRdpWoDECvtRLyQAXujpbnqtaerrcHRS7CDSLCh96ykBWdWb7NOVhkBMZMU1C7Xq+SxCRvWmT/nqMhOR3CNSFJM4uDbj9rzHcA7suDfZR+/GNQlx0s6/XvZcOT9bWq0sgsnuRrnj5ODTiyInDWNdZuYhtWXZOlZQosa7+9v+hiJEXZ6ZBXg2mySFgPh2USwwKQbcA4xPf9AP6k4+hP170XZERCSC9vKPlwmzFTgoSj7RN1EzXTI3qa6gXzKeDExLXF+cLqruJf3tT49Xp06Tmf+pfd1rzt4cFWBQkEwm3V2aMq0sIeiPZ3sxgOHuVuLXQpt5h9TFGZA0p/9yFjPEsrHDzyiebgKmOfnmz69PlplRxCwijpXcZNiR0oq8KB6ORqPhILpxcpjFonLMsIAKwmDdLWuFlQhMVTTR1dZhpatG4lKtSEhZ1Us52dLry51iZsvzpVYEYkP9QicTfUOvkYi7ZRY72xnErl5VC00iIGWpN6PkqrCqOBEHmJVceq6pywaKnUpmOxvhQtHBL88vKrvOaCxprT8ICceHzw9Gm04BAcRasQAGs9lR3YAIt7PFnVgHiHP3ksijOA5TERJRfhIHD6lZTsEszKm3TjNXEue7L3rXd3YWAKw4K0Aw2B6lDdCsLs5X631z+8W74/NWlJTvyjeBzZdpC6FgsnfV4XyxKoQAr9frdpgwChUAk8/T9uZNOhakXbp3GoDoth00s/1NwKSvvv7i9dmyMWLXxejYqbU9rNjTSnl+PBxPR6NBtGn1FauiZe0Bjdh14pXW0hoOlAWZIrsq6SnGGibVQFppASgWMt4ob9djYYxjImeldS2ElDYw/nTtRnDONoY1jGs3iFmIM5Z9GMu2dWueTdB4k6JzjDhrrCXNxpmiJVhntSX48Wx/IwgWev/v5qflEo50Z6mBWAhwEu5+/ncH4U00UFOTttK0xgHobe+9uqw1Gds2G3SiNXULjbZtzd2k4LAXR9oBDhz17wJGmsaIAkFMVnCHFla1179or/FimhYM1zbGCUCj2dZpzozy/OhkLUDGLy5evzt1RFTPMyWmdiTC4+cv1jEQzepy0SgyTgVX5AZrJk3ILi7za0WyMUKaRJqlBgD2q2o5mVeOrwFz8eoPX7y6rB3g4Ij4Os7JKRB7vvbD3nC0NZmM7tSaL9IKWrEi5xzpNWBIRHvaQGyV5u4qWMGKZk1WKcUANINh2quhdtaKImVYaearm7imsdemrGWPnFizuW6dtewxserqPQq0trgmFwBxFloRG0VEopgcs9fbff70VpRr8unqsn21DlfodmEiB3g7v/wPv97dNBocaWpNaywAvXXw1dtCeXCtuZF7Is4aVmSMuZcmrqOkH9VEzvn3bC+IWEeaCHJdBZAUSZnVGyVdrWEN50wnWZO92dcg7Zrl0avtZ93s73728swuAU3StgCzEzV8/g+f73T3zC7nuQnZCV9FRTgVBlqUK86vASPWOGioK1oFTCxN1ZgbwJx98a//8vayBhMYDiybReIYAq8/HG9NpqPkjuXliqJxigQEh3X0rvKUCAhQTqrimrqDCNaBVY4BR7C3ctmlq/oHgWPHzolTNzUZZF3/bm0I3YgYAfjmnuycgHBTWVFA1OWud8WkWfnDrU9ezG53Y/JihfDtvLLrGrnS1RXY+sV//O2hv/k045xci7jx/m7vwgncppdOIE4cBGLvkco6Hg7CRgjCvcG9DJOr/fVauRc4xq2sGuvECZxdFzRItrd6JAIUp28PZ93WHx78tqCXab0+44JEq+TwP/ynX6x3pGyZVSJw8MI1KeC8wFcGUq0WV3a1bBRMkJtIILoxq0//9Z/+eJS2QrbTeG5qLUB5SpEOkp3dnelooO8TIIYjB0+Z1k96kQd0RQl65GtlKCRzVYiFvV5cKq0crgIHrPLC3vqsA+agH1fQustvZ0AcvDC6vuxF/VJT4PX8DdcO+b2+8dV1cc3uZ2EUBWqtJAZxXAmLQkcoUeCPdp5+8uTuYQdPbJT86eVF2XbFSBisgvH2i7/7zWcbRhyH/UEZOX8Qd3Xehk+e7qWtzzSIN7wZ7PcH0FBx/144OiezvaUYcm402717BAf5vX6/sorMFXfAYA7DmxhlVkE8gAeVJN2w9GZ7u+elB7/XLlbt2gqZ/YbD3tt521oIKeYwefL5f/7tU1o7/VvVswHpwdZknXUZjra3yoINtLRrwLAfJYkSLXZt2mptw94w6uSBBlZf/fffvV0ySJxA3VA0sjZe/Hgye7L3UKAcoKNxnTvFNtZ7kzUVFU33nQmVdRyMr3YwCgbbVUHqpi4LO463twfdO6p4siM5Ni9b6u1M1hKNw8Gszhg23B2GN0x9MNyra1/ZrkgKaP2z2faau9C94Qy5Y3T1FYgpTKZ7Tw7uxY/op0E4GB8tC9M0TlgrL+rvHP7yF083uZJg+HSRe0Lb++MAAKLt55/ZShv/YGfg30SzTJ5mS5AZHE7vMXPJ/qdN3JCjyYsnkzuyWg/2ln5p9Y0EJUAheXFtpXE4eVrMFdzwYLunAISTpy+qlQeE2+FNXM4Be9GXx2nZOsD3vMHs+ee/fnLl0aN478VKw04/uXrnePsw91JIM55cEZH+aD/1S6uujvwQUsYMnm/Ha8C4o9/97u280bzJizkmsYq0BvvD2cH+3njwIE8cb9t+JQQx/taVJtnb+dWo0QQhL5mtpZLuz5pBuY6Z7sKerArHO+tE62C0T+M7lzmc7A/XqmF/p40LAOH2zsbZRNHss0GlSTY8OmTRG+11MwpvuK/HlfBalSWt43g0nT4QKeTte8P94/kyz2sj2gujZDx7crh3a4lE+/+QZMqpyfN1qO3W83y7hPV2Ptm+5lT08KAarACXHDyb3F1hw08kOa9JePzs0607aApnv4qeVY7XwF871rn/ZD+4vvWTcpQCiPcPO/k0/jQfpAzy+rs3VWT5wOvvv7lc1a3jsNef7B7s719dVPHu58OUQcNPDsfdOEa7dbifiXPJi8l6ZIOdX8bz2hJdvYqQ2P7hk2SNn7P/8n/9c2YddSKMuiAXYgIrL2Dfn+w9e74zfg+lWSxWWVekxEu2r3xg8/NlAwJIhYPRejmb1Sprb/kDBF507bJt01Vqbl92Xnztb3HpMq0dw08Gm1kBq/P8boyBOC++vmuzXBVtZ+1BiDw/CuLwPf6FIp3P52latVBhrzccTsZ3z5WZvzurBCremq7PW1kdX1RWvGSydbOamsXlZemAaDy9Bxik84u0BnQ83U7uDmh6Mc+aW/SNCFEw3L0uidrMz+e1AwfDyaRDaH58Vjgh5Q+3Zxs/TC/PLpZFY1WUDCfT8cYCyecXae2gelvXfGQ5v1zUDgi3rid5eb7MW9ncagT+eKdLWqfLl//4f/+ZtIgD646FUsTMREqz5/cmB88/2X2/o6Zpm85S5CC6HoOyMQ4MkPbC66deR07RFaev1EYUUlPL7ctgb+Ny21gBKe92YnbT2m4Z0E3XyLuhiaRub8r9kNbfWlHOFFmelwYqjKJeHN0HVlkaAXk3vEJTNiIchP6t8OTaOJAOH0KmKRsr4CB64EXaqjWbvLGDEFSw8R6ubFoBef51deWmrAUg5d25YZpnVWNV0O/3bhPKTW2MgPyNuAVX1taB9MaTmspYyPWrOAAqWOc40P979E//eKQ9K2BFirhLJFTE7Gn2o9nhi093vke07L/tJnVjoDxf/9vviWmFfox+6H+6fFcRXLcQ5U7ilE72P/103/tbwQso/PeyNsj7kWZN/y6bV3BwDAhBHF9XOXLs9fdefLav8dge2zVgvjaNhdh1Cbgrm1WIIBzNnn3yiJfHdgswS2fs1V4kJHC8ZglZvMnh80e8PLbbgDHW2eskPrkiYQAmimbPDuLHIXpst/hqey9zSjozlYJke2/yOEKP7TZgiFir68iRjjByBDjVG08njxvSY7uzJfWdqe/HPhKg++Nh+DhAj+0OYPbq3FagLkNV3I1HSfeT2HscoMd2Z0v6/JOxNg8UhmIdPFSP4rH9rUuYfzgxR45Z7Ea8WbcrqQ8+D+ix/Q0B5u+H6VcL1o6w5mBcV0fDWdPax/F5bHcBc0ine4vGdXWf3I1IEVPm9eP4PLa7qoq3/+kvnsbMnuIut7nLGRNps+X3OQvwsf2NSBiET35d0rtculL26xPLALSry0X+SPQ+truAwezzVugkE2ISiAW6c9FNcXF28cjcPbZ7gNGHAuaT3LEj6U4ccwS4Oj15M9x/HKLHdgcw8A4s++Fx2jpCl2Qi4sShPH+ZxMPHMfprayJEcI5/SAnrpuWQ/lLAIHwexoP47bxEl4YNsTBE5uKboO9HjzP0V9XKrDYgCHTkB0T4PmRZlS6aeJr8xYCBf+hFUf/ovGxEHBQIzjFcfuIPwkP/cZL+ipq5fLcsXXeiW6Sh/bj34eLl3dtLbIV9+osBA9oPh9uvXp5cZq3TrLoK8Namx7GSg0cZ81fU2sXRyTKr2R/PGs9Zf7wdffD8X3755SrxG/kIgAEmyXg2fvn6Iq2uirYLyKSv4eyT5HGe/nqaa4qL05WehGKreTnQ4w+efrl49cr2PP8vOr7jxmz29uP+dHZ8epmVxoKYQIrbOVxbPR3z40T9lbRguFVkF0Yne4fRWT4n+XAPcbGcV6PZ7C9b/ps8yzCaHhwfvT19VzSOqSu43y5sWxbrclWP7edvvMtsCzv87O+fm8qW34OLl/ll4c2eP40/GmDgz0aT7e2j6Twt6saKBdg2Kaypytno0XP919H83Xp54bY+fZGgT6bM5q4rV1imre53YGgbS4EP5JkNe1dBcO78zXHqDaYDoFza7lAYtE1F4VprXqs2jgHkmfG7294t5H+HyfV3BtMnZxfnZ5fLshEImNBe2HS12ij29th+1qYVdH8ySQC4enUiven+ECjfHqXh7HAItPPLAtFw5Odv3tXDnb01HhZvv3k9HwJA/vq4Svb2I1TLdFWFk50IgKSZl4QwRaUTtXh7Vif7Bz7Mqg1jLivnX50Jco/6j6KtvcXZyen5KqvaVkgpV9RpkWXZePQImb+GJmVuwiQGpGoqc5J5M+55OHv11TLK/Z4n775+W0bbUDh/+TYflvopA0C7On59miWuKt2br1/mwybYMe/enM5li8cRgOLdWfjEt/N56VX69KvXzdgG2zQ/K0ckF0v0p2vl+gFfkT8djrfn89ViuViVtTNG0DiTXox3toaPFvbP3+osrfu9EMiyotSr3BTDUbJ6e/Ru3tP9/nb+6ndfu72wXKUnx5fLpev1pwBgq+XFSjyuTlev354uF8GIq6///DZN1BMCgOzoVRxE1fF57RXq3duTqvQjo8/fNqZn3p6qHf+qcMuDQm8y2i/y+cX5+WJRGyNOtZfL49GT/dk4eYTMz92aNG117AHzVYXAMxmfn64ujgvykZ/2bXn01Zt4x8Pi+LTRKj9/N456ABjGcDiK7OnxSaG5XJwj+/qrU+mHkQfAledHye4oPboQP0fWaG1WR40/PzWDqj593etdnQf+Hm80R9F0a2vncr7KyrKpW1tXMq+yy9FgnCSPO9PPS92VpfN7oVTLTIZbu3nrsrmc5XFcNi49ITvPeGt/6l9clsk4OK/nl5MeAC+MeuPR/oTn79J4FKWSyvys9JODg60IAGxb6rqan2chMuuNh6XBwvhlwYI6XTGujvP4lvCFXm+6n+dFmqZpVmSoTErLMN7ano4eIfNzNtO2HA9jKpdVOHi2v2wzt8rP/K1xO59Xc4/b3vC3vx6XWWoHU78p67ICAOrFw2D3cGqrnHe3Fkeuubwo492DX346BQDSnqK2SFPrq2WzfRhll2kz94WjSJnGeUmPvxMwQBiOTZOn6SrN8mXuNLKVWs2n02E/Cr3HFJSfCzCN86JYo0ibaPbJTnwp1Kwuox0PBGlzpsns82eUrlIyVsRe5SeGYRTsbkXLSuLZk7hamjrH9Nkvn3UFNsmLetrkRRPEEBPsjufS1q3xgmGixale0scHAAaA1r1xnZdVmaV1XaSZWTXpxWAYJ3EcBY/UzM/RytoEvT6Q5200mQwKzTDVsnhrzLLWVLOa7M36y+VigZNyeU46XHPBgiCJTVqqZNDP4Jq24dHTw6ua6NoLTEYl+4FT5IdRCqA1FCUhjFPh9dEIHxBRp3UM1zRFkabLVVFbk5qqX/TjfhR5jwF5P73OW9VWRyGkKW3cD8VYAcRUJ42YMPFdzb1R5PKLVSOXVdEOhuvDCkzbaI1yWUfDHpu6DgDVn1xX59OBLi9bE8Z+7YW+MkXWMDmEsS+t0zeFlj5wxjkMB6Yosrwsq9ZAuRqm6gVh4Hn6Uc78pK0qGwShD2lr6fV0UxlYC22d8/vjqbtoECWBzdJaMas4mR5sdfRvVbdgl6/a/iDmtmk0FPyb0rCez2Vr4kHCjqOImzRrWbXoDYOqlo3j1L+HiNCDQWtMUzd1U7cCQ65p/CAM/EfP5E/ZiqJWfgC4ukUQubKwYhuKe5PtpD9JVvNKB6FqihLD/iDxgsmTUUfcFaUjJXUuURK6tm6hlNs4h0WxyVobD/umZi9UdZY7j4R7Pa5Kq2/m+PvtKZ2m21RV1RgLpRjWaPsImJ9yR8oyowMNmNYg8F2ROzTK2+7tbMVhErS2UV6o2rwOpruTiFV/2u0mZdY4Ile3Khn6ZdNYsN70E7FrVoWnR+Flg6in8yLzIk0UhFSV0NdnZOKHKCG+n5jWOrc+6+RxS/opW52uWi/0gKZuyPdtVhI7642m+2NlfbZNE/f6AVoT7L6Y6LoN1gcIZGmtAk3GelEoZe0AUkrfSlzM8ok/4vMGgY+2av3AEDHVaYnoutArfpjWel2j0VnQo+L7k6owq2UbRh5Q5HWoqExL+M55XhwHVVoGZdly1CO01o96vimLsOcDQL1aleRpiHFt1sxL9uBYbx75bJva6qgn0po6X6Y1fL92Vb5aHc2pF0HqxgvphwLmRpD9jW9Hm5V11qegblT0ujo2/d5X3bffaf2j2x+tK2w0y1WbRB6wzNtQS7kquWfEVtk8Xy57o6J2XhyBxLb5PC2WzWQwAIAmXTXKV4DUq2OXZqFmC2/jiGUxLYJeHBoy1eqkyOsgiWubz/Xpy3Sa9OXsXZbsbBH0v63JIUBuDa+T7mDm65mRh46GdA/Myu3/u/dcdvc/ko3pdHzrO7IJGLl9RwcAvD7uTe4dqOzWP934VNzGwZGkgrgHoG1a7iUBirJlX6MppdezZTEv5kFejb2alB8B2tf1aWPLJgi7M8raqkIY+17k1aeLBsFQ6pKjjSOWycGPtgc+Rbo9y/uKtma9XNJ35btj3RsN7OkfF9teEv5VAEZupkc21unGfMnG/zc/EsB2xznINWCuDvuRm4kluwbU+mQjt4Es6mamO0T9Rhy49Q0drmDqriDgGHQNsVuzLg68efC2APYO3EgcNkFPV4cj2XtIvn0nDvrTWdSpA+NBKLXRyTBSID+Z0OroNAsHQRx5Ouz3fSAaDU7fnVqVDNfeYicUJIPYG42Ozlo7OJzh0gWDjYMnCRxPd8ZhMEouLmy8vbX/BCvOjleLNhlN4npxuvAah58LMHJrFV9LhatR6yZb3NWUXM+w28RKByORq9HtALOmwtcnF5PcAGYTeNczxHAdDroz1unq1q77QzaQK9dvwNfwcbckjxPagMwazrewzw6y2Q26WgBWbiSk657QHUnWnfYtOpz44wjwk229Nw6AcOyNEj8Yua2ZP8+Ps8rfOtgNaLs/CYFwtl+dF2oye7GmclU4CCeTOJjNi+NCxdsHTik9Hd4EBLeiB3v74wjbs7PzjNXW891yPlq2pZo8PZhGLTgIff2zAeaWZcXu3sfrauQbkrwbc9qc9psl6kDXgHG8RiMBvF7RdB8wQlczRnIlQuTW5HcbiGxsWiJw3vrCWhrKzV1vTm2y1zfRbkOcrCF4IyKFQLLGnHcNmM2fXMlb57QfaALQ3wm82UgjGOzX/WFvZDHaDvxsRdg9fDaFQjuJAEyfGT/1dj59vj4MJZpYGW7FPD2oKQuf7M8cR3q4cSh2XlIy2xkAk/3ULfq7B3uePz2k1tPx/pMh+eODamfo4efdkq4ON7zeqdejtnmWnZNbUnq9uvnW57KhR9z6LYMEjt19LdPdbEmb0s5iQ1HalIfujkpCaw3DXnXD3ciMW4Js80fXgpLo9ot2ILmjg90+q1apeBgB6D/d1v0eEE1jG0YeetyLsCXhIQa7Mx+6J1EEIDkM9wpvOLs6PCea9SnqM6IDb1b5450B/KGKboKbyrMVku2pB3gHaisPt/c8YBc7rdK90chHtBuYZEi3lazHdl9h3jwz6L5s3NS+r+Xld1hCcv8m32lCAUKsv80ibVvoO0EnjaUHSfjW4q7b2J29/eao3f/tr7pDoSvH6yOEWgvlXb/ChtL12P6WW/n2y68WwZNfvPiAyguPtP5jQ/r6j/96JNsHH1Kp45GmfWyolmdnPvqDD/nu/w81XNPqcHygWQAAAABJRU5ErkJggg==" alt="Allied Universal"/>`;

// ---------------------------------------------------------------------
// CSS (page layout matches the printed Allied Universal DAR form)
// ---------------------------------------------------------------------

const FORM_CSS = `
@page { size: letter; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Helvetica Neue', Arial, sans-serif;
  color: #000;
  font-size: 8.3pt;
}
.page {
  width: 8.5in;
  height: 11in;
  padding: 0.32in 0.42in 0.28in 0.42in;
  page-break-after: always;
  position: relative;
}
.page:last-child { page-break-after: auto; }

/* generation timestamp stamp — sits in the bottom-right margin,
   absolutely positioned within the page box so it never adds to the
   page's height or pushes any form content around. */
.gen-stamp {
  position: absolute;
  bottom: 0.1in;
  right: 0.42in;
  font-size: 6.5pt;
  color: #9ca3af;
  font-family: 'Helvetica Neue', Arial, sans-serif;
}

/* header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 3px solid #161616;
  padding-bottom: 5px;
  margin-bottom: 5px;
}
.logo-block { display: flex; align-items: center; flex: none; }
.logo-img { width: 1.9in; height: auto; display: block; }
.title {
  font-family: Georgia, 'Times New Roman', serif;
  font-weight: 700;
  font-size: 20pt;
  letter-spacing: 1px;
  white-space: nowrap;
}

/* instructions */
.instructions {
  font-size: 6.8pt;
  line-height: 1.28;
  margin: 0 0 5px 0;
  text-align: left;
}

/* section bars */
.section-bar {
  background: #161616;
  color: #fff;
  font-weight: 700;
  font-size: 11.5pt;
  padding: 3px 9px;
  letter-spacing: 0.5px;
  margin-top: 5px;
}

/* section I */
.sec1 { padding: 5px 4px 6px 4px; font-size: 9.5pt; }
.row { display: flex; align-items: baseline; gap: 7px; margin-top: 6px; }
.lbl { font-weight: 700; white-space: nowrap; }
.line {
  border-bottom: 1px solid #000;
  min-height: 12px;
  padding: 0 4px 1px 4px;
  font-weight: 400;
  font-size: 9pt;
  white-space: nowrap;
  overflow: hidden;
}
.line.fill { flex: 1; }
.line.w90 { flex: 0 0 90px; }
.line.w70 { flex: 0 0 70px; }
.line.w55 { flex: 0 0 55px; }
.line.w45 { flex: 0 0 45px; }
.line.w40 { flex: 0 0 40px; }
.line.w35 { flex: 0 0 35px; }

/* section II */
.sec2 { padding: 6px 4px 7px 4px; font-size: 9.5pt; display: flex; }
.sec2-col { flex: 1; }
.sec2-col.right { padding-left: 26px; }
.sec2 .row { margin-top: 7px; }
.ampm { font-weight: 700; white-space: nowrap; }
.ampm .sel { text-decoration: underline; }

/* section III table */
.activity-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0;
  table-layout: fixed;
}
.activity-table th {
  border: 1px solid #000;
  font-size: 9pt;
  font-weight: 700;
  padding: 1px 4px;
  text-align: center;
  background: #fff;
}
.activity-table td {
  border: 1px solid #000;
  font-size: 8.3pt;
  padding: 1px 5px;
  vertical-align: top;
  height: 21.6px;
  overflow: hidden;
  white-space: nowrap;
}
.col-from, .col-to { width: 9%; text-align: center; }
.col-report { width: 82%; }
.daily-report-head { font-weight: 700; font-size: 10pt; }
.daily-report-sub { font-weight: 700; font-size: 8.6pt; }

/* section IV */
.sec4-text {
  font-size: 7.3pt;
  font-style: italic;
  font-weight: 700;
  line-height: 1.3;
  margin: 4px 0 3px 0;
}
.sec4-checks {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 8pt;
  font-weight: 700;
  font-style: italic;
  margin-bottom: 6px;
}
.checkbox {
  display: inline-block;
  width: 9px; height: 9px;
  border: 1px solid #000;
  margin-right: 3px;
  vertical-align: middle;
  position: relative;
  top: -1px;
}
.checkbox.checked::after {
  content: "X";
  position: absolute;
  left: 0.5px; top: -3px;
  font-size: 8px;
  font-weight: 700;
}
.sec4-checks .blank-init { display: inline-block; border-bottom: 1px solid #000; width: 20px; }
.sec4-checks .explain-line { flex: 1; border-bottom: 1px solid #000; min-height: 11px; }

.sig-row { display: flex; align-items: baseline; gap: 10px; margin-top: 4px; }
.sig-row .lbl { font-weight: 700; font-size: 9pt; }
.sig-line { border-bottom: 1px solid #000; min-height: 13px; padding: 0 6px 1px 6px; font-size: 9pt; }
.sig-line.officer { flex: 0 0 47%; font-family: Georgia, 'Times New Roman', serif; font-style: italic; }
.sig-line.sup { flex: 1; }
`;

// ---------------------------------------------------------------------
// Page builder
// ---------------------------------------------------------------------

function buildTableRows(rows: ActivityEntry[]): string {
  const out: string[] = [];
  for (let i = 0; i < ROWS_PER_PAGE; i++) {
    const entry = rows[i];
    const from = entry?.from || "";
    const to = entry?.to || "";
    const activity = entry?.activity || "";
    out.push(
      `<tr><td class="col-from">${esc(from)}</td><td class="col-to">${esc(to)}</td>` +
        `<td class="col-report">${esc(activity)}</td></tr>`
    );
  }
  return out.join("\n");
}

function buildPage(dar: DARRecord, rows: ActivityEntry[], pageNum: number, pageTotal: number): string {
  const radio = mark(dar.received_radio);
  const pager = mark(dar.received_pager);
  const keys = mark(dar.received_keys);
  const detex = mark(dar.received_detex);
  const other = dar.received_other || "";
  const onDutyMeal = mark(dar.on_duty_meal);
  const submittedStamp = formatSubmittedStamp(dar.submitted_at);

  return `
<div class="page">
  <div class="header">
    <div class="logo-block">
      ${LOGO_IMG}
    </div>
    <div class="title">DAILY ACTIVITY REPORT</div>
  </div>

  <div class="instructions">
    <b>INSTRUCTIONS:</b> Security Professional must complete Sections 1-4 for each day worked. Use additional pages if necessary (section 2 only needs to be completed on Page 1). Section 3
    &ndash; Activity Details is for time activity only. Activity is to be logged at least hourly <u>or</u> as incidents occur, must be <i>printed in ink</i> and must be <i>neat and legible.</i> Any security or &ldquo;significant&rdquo;
    incidents must also be written separately on an &ldquo;Incident Report&rdquo; form and attached to this log. Place an asterisk * in the margin of Section 3 by the line where the incident has been
    recorded to draw immediate attention to it. Also list any relevant &ldquo;passdown&rdquo; information for the person working this post after your shift to advise them of any situations.
  </div>

  <div class="section-bar">SECTION I: EMPLOYEE INFORMATION</div>
  <div class="sec1">
    <div class="row">
      <span class="lbl">OFFICER ON DUTY:</span><span class="line fill">${esc(dar.officer_name)}</span>
      <span class="lbl">TODAY&rsquo;S DATE</span><span class="line w90">${esc(formatDate(dar.date))}</span>
    </div>
    <div class="row">
      <span class="lbl">CLIENT/SITE:</span><span class="line fill">${esc(dar.client_site)}</span>
      <span class="lbl">BRANCH:</span><span class="line w90">${esc(dar.branch)}</span>
    </div>
    <div class="row">
      <span class="lbl">SCHEDULED SHIFT:</span><span class="line fill">${esc(dar.scheduled_shift)}</span>
      <span class="lbl">PAGE:</span><span class="line w35" style="text-align:center;">${pageNum}</span>
      <span class="lbl">OF</span><span class="line w35" style="text-align:center;">${pageTotal}</span>
    </div>
    <div class="row">
      <span class="lbl">RECEIVED ITEMS:</span><span class="line w45"></span>
      <span class="lbl">RADIO:</span><span class="line w35" style="text-align:center;">${radio}</span>
      <span class="lbl">PAGER:</span><span class="line w35" style="text-align:center;">${pager}</span>
      <span class="lbl">#OF KEYS:</span><span class="line w35" style="text-align:center;">${keys}</span>
      <span class="lbl">DETEX:</span><span class="line w35" style="text-align:center;">${detex}</span>
      <span class="lbl">OTHERR:</span><span class="line fill">${esc(other)}</span>
    </div>
  </div>

  <div class="section-bar">SECTION II: RECORD OF HOURS WORKED AND BREAKS</div>
  <div class="sec2">
    <div class="sec2-col">
      <div class="row">
        <span class="lbl">Time In (shift start):</span>
        ${ampmField(dar.shift_start)}
      </div>
      <div class="row">
        <span class="lbl">Time Out (shift end):</span>
        ${ampmField(dar.shift_end)}
      </div>
      <div class="row">
        <span class="lbl">Rest Break Out:</span><span class="line w70">${esc(dar.rest_break_1_out)}</span>
        <span class="lbl">In</span><span class="line w70">${esc(dar.rest_break_1_in)}</span>
      </div>
      <div class="row">
        <span class="lbl">Rest Break Out:</span><span class="line w70">${esc(dar.rest_break_2_out)}</span>
        <span class="lbl">In</span><span class="line w70">${esc(dar.rest_break_2_in)}</span>
      </div>
    </div>
    <div class="sec2-col right">
      <div class="row">
        <span class="lbl">Time Out (meal break*):</span>
        ${ampmField(dar.meal_break_out)}
      </div>
      <div class="row">
        <span class="lbl">Time In (meal break*):</span>
        ${ampmField(dar.meal_break_in)}
      </div>
      <div class="row" style="margin-top:14px;">
        <span class="lbl" style="font-weight:700;">* Check here if your post has an &ldquo;On-Duty&rdquo; paid meal period:</span>
        <span class="line w45" style="text-align:center;">${onDutyMeal}</span>
      </div>
    </div>
  </div>

  <div class="section-bar">SECTION III: ACTIVITY DETAILS</div>
  <table class="activity-table">
    <colgroup>
      <col class="col-from"><col class="col-to"><col class="col-report">
    </colgroup>
    <thead>
      <tr>
        <th colspan="2" style="border-bottom:none;">TIME</th>
        <th rowspan="2" class="daily-report-head">DAILY REPORT<br>
          <span class="daily-report-sub">Record all activity below. Attach all Incident Reports and supporting documents.</span>
        </th>
      </tr>
      <tr>
        <th style="border-top:none;">From</th>
        <th style="border-top:none;">To</th>
      </tr>
    </thead>
    <tbody>
      ${buildTableRows(rows)}
    </tbody>
  </table>

  <div class="section-bar">SECTION IV: EMPLOYEE SIGNATURE</div>
  <div class="sec4-text">
    By your signature, you acknowledge that the information on this DAR is a true and accurate record of your time and account activity today. If you did not receive a meal period or rest break
    today, you must indicate such on this DAR, along with an explanation of the reason(s), otherwise the Company will assume that you received all meal periods and rest periods as required by law.
  </div>
  <div class="sec4-checks">
    <span class="blank-init"></span>
    <span>I did not receive my</span>
    <span>${checkbox(dar.missed_rest_break)} Rest break</span>
    <span>${checkbox(dar.missed_meal_period)} Meal period today. Explain:</span>
    <span class="explain-line">${esc(dar.missed_explanation)}</span>
  </div>
  <div class="sig-row">
    <span class="lbl">SIGNATURE:</span><span class="sig-line officer">${esc(dar.signature)}</span>
    <span class="lbl">SUPERVISOR:</span><span class="sig-line sup"></span>
  </div>

  <div class="gen-stamp">${esc(submittedStamp)}</div>
</div>`;
}

// ---------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------

/**
 * Builds a full print-ready HTML document. Each DARRecord becomes one
 * page (or several, if its activity log has more than 18 entries).
 * Every page gets a small "Submitted [date] [time]" stamp in the
 * bottom-right margin, taken from that record's own submitted_at value.
 * This is a fixed timestamp — it reflects when the officer originally
 * submitted the DAR, not when the PDF happens to be printed, so it
 * reads the same no matter how many times or when the form is reprinted.
 * The stamp is absolutely positioned inside the fixed 8.5x11in page box,
 * so it never adds height or shifts any of the form content.
 */
export function buildDarFormDocument(dars: DARRecord[]): string {
  const pages: string[] = [];

  dars.forEach((dar) => {
    const rows = (dar.activity_log || []).filter(
      (e) => (e.activity && e.activity.trim()) || e.from || e.to
    );
    const chunks: ActivityEntry[][] = [];
    for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
      chunks.push(rows.slice(i, i + ROWS_PER_PAGE));
    }
    if (chunks.length === 0) chunks.push([]);

    chunks.forEach((chunk, idx) => {
      pages.push(buildPage(dar, chunk, idx + 1, chunks.length));
    });
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Daily Activity Report</title>
<style>${FORM_CSS}</style>
</head>
<body>${pages.join("\n")}</body>
</html>`;
}
