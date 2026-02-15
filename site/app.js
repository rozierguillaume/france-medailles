const COLORS = {
  gold: "#c9a24d",
  goldLight: "rgba(201, 162, 77, 0.15)",
  silver: "#9ba8b5",
  silverLight: "rgba(155, 168, 181, 0.15)",
  bronze: "#b07d56",
  bronzeLight: "rgba(176, 125, 86, 0.15)",
  total: "#1a1a2e",
  totalLight: "rgba(26, 26, 46, 0.08)",
  accent: "#0b3d6b",
  grid: "rgba(0, 0, 0, 0.05)",
};

const FONT_BODY = "Inter, -apple-system, BlinkMacSystemFont, sans-serif";
const J0_COMPARISON_YEARS = [2026, 2022, 2018, 2014, 2010, 2006, 2002, 1998, 1994, 1992];
const J0_ACTIVE_LINE_WIDTH = 5.2;
const J0_HISTORICAL_LINE_WIDTH = 2.4;
const J0_HISTORICAL_SATURATION = [0.85, 0.78, 0.72, 0.66, 0.61, 0.56, 0.52, 0.48, 0.44];
const J0_HISTORICAL_OPACITY_MAX = 0.68;
const J0_HISTORICAL_OPACITY_MIN = 0.24;

Chart.defaults.font.family = FONT_BODY;
Chart.defaults.font.size = 11;
Chart.defaults.color = "#555770";

// Watermark plugin: olympic stripe + URL in bottom-right of every chart
const WATERMARK_PADDING = 20;
const watermarkPlugin = {
  id: "watermark",
  beforeInit: function (chart) {
    // Reserve space below the chart for the watermark
    if (!chart.options.layout) chart.options.layout = {};
    if (!chart.options.layout.padding) chart.options.layout.padding = {};
    var cur = chart.options.layout.padding.bottom || 0;
    chart.options.layout.padding.bottom = cur + WATERMARK_PADDING;
  },
  afterDraw: function (chart) {
    var ctx = chart.ctx;
    ctx.save();
    var stripeColors = ["#0081c8", "#f4c300", "#1a1a2e", "#009f3d", "#df0024"];
    var fontSize = 9;
    var stripeW = 40;
    var stripeH = 2.5;
    var gap = 5;
    ctx.font = "400 " + fontSize + "px Inter, sans-serif";
    var urlW = ctx.measureText("francemedailles.fr").width;
    var totalW = stripeW + gap + urlW;
    var x = chart.width - totalW - 10;
    var y = chart.height - 6;
    var segW = stripeW / stripeColors.length;
    for (var i = 0; i < stripeColors.length; i++) {
      ctx.fillStyle = stripeColors[i];
      ctx.fillRect(x + segW * i, y - fontSize * 0.5 - stripeH / 2, segW, stripeH);
    }
    ctx.fillStyle = "rgba(139, 141, 163, 0.5)";
    ctx.textBaseline = "bottom";
    ctx.textAlign = "left";
    ctx.fillText("francemedailles.fr", x + stripeW + gap, y);
    ctx.restore();
  },
};
Chart.register(watermarkPlugin);

function hexToRgba(hex, alpha) {
  const v = hex.replace("#", "");
  return `rgba(${parseInt(v.slice(0, 2), 16)}, ${parseInt(v.slice(2, 4), 16)}, ${parseInt(v.slice(4, 6), 16)}, ${alpha})`;
}

function saturateHex(hex, factor) {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  const sr = Math.max(0, Math.min(255, Math.round(gray + (r - gray) * factor)));
  const sg = Math.max(0, Math.min(255, Math.round(gray + (g - gray) * factor)));
  const sb = Math.max(0, Math.min(255, Math.round(gray + (b - gray) * factor)));
  return `#${sr.toString(16).padStart(2, "0")}${sg.toString(16).padStart(2, "0")}${sb.toString(16).padStart(2, "0")}`;
}

function highlightDataset(chart, activeIndex, originals) {
  let changed = false;
  chart.data.datasets.forEach((ds, i) => {
    const targetColor = i === activeIndex ? originals[i].borderColor : hexToRgba("#999999", 0.08);
    const targetWidth = i === activeIndex ? originals[i].borderWidth + 1 : 1;
    if (ds.borderColor !== targetColor || ds.borderWidth !== targetWidth) {
      ds.borderColor = targetColor;
      ds.borderWidth = targetWidth;
      changed = true;
    }
  });
  if (changed) chart.update("none");
}

function resetDatasets(chart, originals) {
  let changed = false;
  chart.data.datasets.forEach((ds, i) => {
    if (ds.borderColor !== originals[i].borderColor || ds.borderWidth !== originals[i].borderWidth) {
      ds.borderColor = originals[i].borderColor;
      ds.borderWidth = originals[i].borderWidth;
      changed = true;
    }
  });
  if (changed) chart.update("none");
}

// Find the nearest dataset line to the mouse position
function getNearestDatasetIndex(chart, event) {
  const points = chart.getElementsAtEventForMode(event, "nearest", { intersect: false, axis: "xy" }, false);
  if (points.length > 0) {
    // Check if mouse is close enough to the line (within ~20px)
    const point = points[0];
    const meta = chart.getDatasetMeta(point.datasetIndex);
    const element = meta.data[point.index];
    if (element) {
      const rect = chart.canvas.getBoundingClientRect();
      const mouseY = event.y || (event.native ? event.native.clientY - rect.top : null);
      if (mouseY !== null && Math.abs(mouseY - element.y) < 20) {
        return point.datasetIndex;
      }
    }
  }
  return -1;
}

// Word-wrap text into lines that fit a max pixel width
function wrapText(context, text, maxWidth) {
  var words = text.split(" ");
  var lines = [];
  var line = "";
  for (var i = 0; i < words.length; i++) {
    var test = line ? line + " " + words[i] : words[i];
    if (context.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Export chart as PNG image with title and subtitle
function exportChart(canvas, titleText, subtitleText) {
  const scale = 2;
  const pad = 32 * scale;
  const titleSize = 18 * scale;
  const subtitleSize = 12 * scale;
  const lineHeight = subtitleSize * 1.5;
  const gap = 8 * scale;
  const w = canvas.width + pad * 2;
  const maxTextWidth = w - pad * 2;

  // Pre-calculate subtitle lines for proper height
  const tmp = document.createElement("canvas");
  tmp.width = w;
  const preCtx = tmp.getContext("2d");
  preCtx.font = "400 " + subtitleSize + "px 'Inter', sans-serif";
  const subtitleLines = subtitleText ? wrapText(preCtx, subtitleText, maxTextWidth) : [];
  const subtitleH = subtitleLines.length > 0 ? gap + subtitleLines.length * lineHeight : 0;

  const headerH = pad + titleSize + subtitleH + 16 * scale;
  const h = canvas.height + headerH + pad;
  tmp.height = h;
  const ctx = tmp.getContext("2d");

  // Background
  ctx.fillStyle = "#faf9f7";
  ctx.fillRect(0, 0, w, h);

  // Title
  ctx.fillStyle = "#1a1a2e";
  ctx.font = "700 " + titleSize + "px 'Playfair Display', Georgia, serif";
  ctx.textBaseline = "top";
  ctx.fillText(titleText, pad, pad);

  // Subtitle (multi-line)
  if (subtitleLines.length > 0) {
    ctx.fillStyle = "#555770";
    ctx.font = "400 " + subtitleSize + "px 'Inter', sans-serif";
    var y = pad + titleSize + gap;
    for (var i = 0; i < subtitleLines.length; i++) {
      ctx.fillText(subtitleLines[i], pad, y);
      y += lineHeight;
    }
  }

  // Chart
  ctx.drawImage(canvas, pad, headerH, canvas.width, canvas.height);

  // Watermark: olympic stripe + URL, bottom-right, same line
  const stripeColors = ["#0081c8", "#f4c300", "#1a1a2e", "#009f3d", "#df0024"];
  const stripeW = 60 * scale;
  const stripeH = 3 * scale;
  const wmFontSize = 10 * scale;
  const wmGap = 8 * scale;
  ctx.font = "400 " + wmFontSize + "px 'Inter', sans-serif";
  const urlW = ctx.measureText("francemedailles.fr").width;
  const totalWmW = stripeW + wmGap + urlW;
  const wmX = w - pad - totalWmW;
  const wmY = h - 16 * scale;
  const segW = stripeW / stripeColors.length;
  for (var s = 0; s < stripeColors.length; s++) {
    ctx.fillStyle = stripeColors[s];
    ctx.fillRect(wmX + segW * s, wmY - stripeH / 2 - wmFontSize * 0.3, segW, stripeH);
  }
  ctx.fillStyle = "#8b8da3";
  ctx.textBaseline = "bottom";
  ctx.textAlign = "left";
  ctx.fillText("francemedailles.fr", wmX + stripeW + wmGap, wmY);

  const link = document.createElement("a");
  link.download = "france-medailles-" + titleText.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".png";
  link.href = tmp.toDataURL("image/png");
  link.click();
}

// Find title and subtitle near a chart container
function findChartHeadings(container) {
  let title = "";
  let subtitle = "";

  // Case 1: comparison cell (Or, Argent, Bronze, Total)
  const cell = container.closest(".comparison-cell");
  if (cell) {
    const h3 = cell.querySelector(".comparison-title");
    const stat = cell.querySelector(".stat-paragraph");
    if (h3) title = "Les m\u00e9dailles par jour de comp\u00e9tition : " + h3.textContent.trim().toLowerCase();
    if (stat) {
      // Collect text from all child nodes, joining inline spans with a space
      subtitle = Array.from(stat.childNodes).map(function (n) {
        return n.textContent.trim();
      }).filter(Boolean).join(" ");
    }
    return { title: title, subtitle: subtitle };
  }

  // Case 2: article block (main edition chart)
  const article = container.closest(".article-block");
  if (article) {
    const h2 = article.querySelector("h2");
    const intro = article.querySelector(".article-intro");
    if (h2) title = h2.textContent.trim();
    if (intro) subtitle = intro.textContent.trim();
    return { title: title, subtitle: subtitle };
  }

  return { title: "France M\u00e9dailles", subtitle: "" };
}

// Inject export buttons on all chart containers
function injectExportButtons() {
  const containers = document.querySelectorAll(".chart-container");
  containers.forEach(function (container) {
    const canvas = container.querySelector("canvas");
    if (!canvas) return;
    const btn = document.createElement("button");
    btn.className = "chart-export-btn";
    btn.title = "Exporter en image";
    btn.setAttribute("aria-label", "Exporter le graphique en image");
    btn.innerHTML = "\u2913"; // downwards arrow ⤓
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var headings = findChartHeadings(container);
      exportChart(canvas, headings.title, headings.subtitle);
    });
    container.appendChild(btn);
  });
}

async function loadJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Impossible de charger ${path}`);
  return response.json();
}

function buildEditionChart(data) {
  const ctx = document.getElementById("chart-editions");
  const labels = data.map((r) => r.year);

  return new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Or",
          data: data.map((r) => r.gold),
          backgroundColor: COLORS.gold,
          hoverBackgroundColor: hexToRgba(COLORS.gold, 0.75),
          stack: "medals",
        },
        {
          label: "Argent",
          data: data.map((r) => r.silver),
          backgroundColor: COLORS.silver,
          hoverBackgroundColor: hexToRgba(COLORS.silver, 0.75),
          stack: "medals",
        },
        {
          label: "Bronze",
          data: data.map((r) => r.bronze),
          backgroundColor: COLORS.bronze,
          hoverBackgroundColor: hexToRgba(COLORS.bronze, 0.75),
          stack: "medals",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            borderRadius: 2,
            useBorderRadius: true,
            padding: 16,
            font: { size: 11, weight: 500 },
          },
        },
        tooltip: {
          backgroundColor: "#1a1a2e",
          titleFont: { weight: 600, size: 12 },
          bodyFont: { size: 11 },
          padding: 12,
          cornerRadius: 8,
          displayColors: true,
          boxWidth: 8,
          boxHeight: 8,
          boxPadding: 4,
          callbacks: {
            title: (items) => `JO d'hiver ${items[0].label}`,
            afterBody: (items) => {
              const sum = items.reduce((a, b) => a + b.parsed.y, 0);
              return `\nTotal : ${sum}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          border: { display: false },
          ticks: {
            maxRotation: 45,
            font: { size: 10 },
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: COLORS.grid, drawBorder: false },
          border: { display: false },
          ticks: {
            stepSize: 5,
            font: { size: 10 },
          },
        },
      },
      barPercentage: 0.7,
      categoryPercentage: 0.85,
    },
  });
}

function buildComparisonChart(canvasId, labels, seriesData, title, color) {
  const ctx = document.getElementById(canvasId);
  const activeColor = saturateHex(color, 1.5);
  const years = J0_COMPARISON_YEARS.filter((year) => seriesData[String(year)]);
  const historicalCount = Math.max(1, years.length - 1);

  const datasets = years
    .map((year, idx) => {
      const borderColor = idx === 0
        ? activeColor
        : hexToRgba(
            saturateHex(color, J0_HISTORICAL_SATURATION[idx - 1] || 0.5),
            historicalCount === 1
              ? J0_HISTORICAL_OPACITY_MAX
              : (J0_HISTORICAL_OPACITY_MAX
                  - ((idx - 1) / (historicalCount - 1))
                    * (J0_HISTORICAL_OPACITY_MAX - J0_HISTORICAL_OPACITY_MIN))
          );
      return {
        label: String(year),
        data: labels.map((_, i) => seriesData[String(year)][i]),
        borderColor,
        backgroundColor: "transparent",
        borderWidth: idx === 0 ? J0_ACTIVE_LINE_WIDTH : J0_HISTORICAL_LINE_WIDTH,
        pointRadius: 0,
        pointHitRadius: 8,
        pointHoverRadius: idx === 0 ? 5 : 3,
        pointHoverBackgroundColor: borderColor,
        tension: 0.3,
        fill: false,
        spanGaps: false,
      };
    });

  // Store original styles for reset
  const originals = datasets.map((ds) => ({
    borderColor: ds.borderColor,
    borderWidth: ds.borderWidth,
  }));

  const chart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: {
            boxWidth: 16,
            boxHeight: 2,
            padding: 12,
            font: { size: 10, weight: 500 },
          },
          onHover: function (e, legendItem) {
            highlightDataset(chart, legendItem.datasetIndex, originals);
          },
          onLeave: function () {
            resetDatasets(chart, originals);
          },
        },
        tooltip: {
          backgroundColor: "#1a1a2e",
          titleFont: { weight: 600, size: 11 },
          bodyFont: { size: 10 },
          padding: 10,
          cornerRadius: 6,
          displayColors: true,
          boxWidth: 8,
          boxHeight: 2,
          boxPadding: 4,
          callbacks: {
            title: (items) => items[0].label,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            maxTicksLimit: 6,
            font: { size: 9 },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: COLORS.grid, drawBorder: false },
          border: { display: false },
          ticks: {
            font: { size: 9 },
            precision: 0,
          },
        },
      },
      onHover: function (event) {
        const idx = getNearestDatasetIndex(chart, event);
        if (idx >= 0) {
          highlightDataset(chart, idx, originals);
        } else {
          resetDatasets(chart, originals);
        }
      },
    },
  });

  // Reset when mouse leaves the canvas entirely
  ctx.addEventListener("mouseleave", function () {
    resetDatasets(chart, originals);
  });

  // Mobile: tap on empty area resets highlight
  ctx.addEventListener("click", function (e) {
    const points = chart.getElementsAtEventForMode(e, "nearest", { intersect: true }, false);
    if (points.length === 0) {
      resetDatasets(chart, originals);
    }
  });

  return chart;
}

function medalLabel(key, count) {
  const singular = {
    total: "m\u00e9daille au total",
    gold: "m\u00e9daille d'or",
    silver: "m\u00e9daille d'argent",
    bronze: "m\u00e9daille de bronze",
  };
  const plural = {
    total: "m\u00e9dailles au total",
    gold: "m\u00e9dailles d'or",
    silver: "m\u00e9dailles d'argent",
    bronze: "m\u00e9dailles de bronze",
  };
  return count >= 2 ? plural[key] : singular[key];
}

function buildMedalSVG(type) {
  const colors = {
    gold:   { main: "#c9a24d", light: "#e8d9b0", dark: "#a07a2a", ribbon: "#c2382d" },
    silver: { main: "#9ba8b5", light: "#d0d7de", dark: "#6e7e8c", ribbon: "#2a6cb5" },
    bronze: { main: "#b07d56", light: "#d9c1ab", dark: "#8a5c36", ribbon: "#2a8c5a" },
  };
  const c = colors[type];
  return `<svg width="44" height="62" viewBox="0 0 44 62" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 0 L22 20 L28 0" stroke="${c.ribbon}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="22" cy="34" r="16" fill="${c.main}" stroke="${c.dark}" stroke-width="1.5"/>
    <circle cx="22" cy="34" r="11.5" fill="none" stroke="${c.light}" stroke-width="1" opacity="0.7"/>
    <circle cx="22" cy="34" r="6" fill="none" stroke="${c.light}" stroke-width="0.8" opacity="0.4"/>
    <circle cx="18" cy="30" r="3" fill="${c.light}" opacity="0.25"/>
  </svg>`;
}

function buildMedalShowcaseForType(containerId, type, count) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (count === 0) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = Array.from({ length: count },
    () => `<span class="medal-icon">${buildMedalSVG(type)}</span>`
  ).join("");
}

function buildMedalMiniSVG(type) {
  var colors = {
    gold:   { main: "#c9a24d", dark: "#a07a2a", light: "#e8d9b0", ribbon: "#c2382d" },
    silver: { main: "#9ba8b5", dark: "#6e7e8c", light: "#d0d7de", ribbon: "#2a6cb5" },
    bronze: { main: "#b07d56", dark: "#8a5c36", light: "#d9c1ab", ribbon: "#2a8c5a" },
  };
  var c = colors[type];
  return `<svg viewBox="0 0 44 62" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 0 L22 20 L28 0" stroke="${c.ribbon}" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="22" cy="34" r="16" fill="${c.main}" stroke="${c.dark}" stroke-width="1.5"/>
    <circle cx="22" cy="34" r="11.5" fill="none" stroke="${c.light}" stroke-width="1" opacity="0.7"/>
    <circle cx="18" cy="30" r="3" fill="${c.light}" opacity="0.25"/>
  </svg>`;
}

var SPORT_FR = {
  "Alpine Skiing": "Ski alpin",
  "Biathlon": "Biathlon",
  "Freestyle Skiing": "Ski acrobatique",
  "Figure Skating": "Patinage artistique",
  "Snowboarding": "Snowboard",
  "Cross Country Skiing": "Ski de fond",
  "Nordic Combined": "Combin\u00e9 nordique",
  "Bobsleigh": "Bobsleigh",
  "Ski Jumping": "Saut \u00e0 ski",
  "Military Ski Patrol": "Patrouille militaire",
  "Curling": "Curling",
  "Short Track Speed Skating": "Short-track",
  "Speed Skating": "Patinage de vitesse",
  "Ice Hockey": "Hockey sur glace",
  "Luge": "Luge",
  "Skeleton": "Skeleton",
};


function translateEvent(eventName) {
  // Remove gender suffix and translate common terms
  var name = eventName
    .replace(/, Men$/, " (H)")
    .replace(/, Women$/, " (F)")
    .replace(/, Mixed$/, " (mixte)")
    .replace(/Downhill/g, "Descente")
    .replace(/Slalom/g, "Slalom")
    .replace(/Giant Slalom/g, "Slalom g\u00e9ant")
    .replace(/Super G/g, "Super-G")
    .replace(/Combined/g, "Combin\u00e9")
    .replace(/Relay/g, "Relais")
    .replace(/Sprint/g, "Sprint")
    .replace(/Pursuit/g, "Poursuite")
    .replace(/Mass Start/g, "D\u00e9part en masse")
    .replace(/Moguls/g, "Bosses")
    .replace(/Ski Cross/g, "Skicross")
    .replace(/Cross(?![-\s]*Country)/g, "Cross")
    .replace(/Halfpipe/g, "Halfpipe")
    .replace(/Aerials/g, "Sauts")
    .replace(/Big Air/g, "Big air")
    .replace(/Ice Dancing/g, "Danse sur glace")
    .replace(/Pairs/g, "Couples")
    .replace(/Singles/g, "Individuel")
    .replace(/Individual/g, "Individuel")
    .replace(/Normal Hill/g, "Petit tremplin")
    .replace(/Team Sprint/g, "Sprint par \u00e9quipes")
    .replace(/Team/g, "\u00c9quipe")
    .replace(/Parallel Giant Slalom/g, "Slalom g\u00e9ant parall\u00e8le")
    .replace(/Four/g, "Bob \u00e0 quatre")
    .replace(/kilometres/g, "km");
  return name;
}

function buildMedalIcons(gold, silver, bronze, cssClass) {
  var html = "";
  for (var i = 0; i < gold; i++) html += '<span class="' + cssClass + '">' + buildMedalMiniSVG("gold") + "</span>";
  for (var i = 0; i < silver; i++) html += '<span class="' + cssClass + '">' + buildMedalMiniSVG("silver") + "</span>";
  for (var i = 0; i < bronze; i++) html += '<span class="' + cssClass + '">' + buildMedalMiniSVG("bronze") + "</span>";
  return html;
}

function buildSportMedals(data) {
  var container = document.getElementById("sport-medals-list");
  if (!container) return;
  var html = "";
  data.forEach(function (row, idx) {
    var name = SPORT_FR[row.sport] || row.sport;
    var sportMedals = buildMedalIcons(row.gold, row.silver, row.bronze, "sport-medal-icon");

    var eventsHtml = "";
    if (row.events && row.events.length > 0) {
      row.events.forEach(function (ev) {
        var evMedals = buildMedalIcons(ev.gold, ev.silver, ev.bronze, "event-medal-icon");
        eventsHtml += '<div class="event-row">'
          + '<span class="event-name">' + translateEvent(ev.event) + "</span>"
          + '<span class="event-medals">' + evMedals + "</span>"
          + '<span class="event-total">' + ev.total + "</span>"
          + "</div>";
      });
    }

    html += '<div class="sport-row" id="sport-row-' + idx + '">'
      + '<div class="sport-header">'
      + '<span class="sport-toggle">\u25b6</span>'
      + '<span class="sport-name">' + name + "</span>"
      + '<span class="sport-medals">' + sportMedals + "</span>"
      + '<span class="sport-total">' + row.total + "</span>"
      + "</div>"
      + '<div class="sport-events">' + eventsHtml + "</div>"
      + "</div>";
  });
  container.innerHTML = html;

  // Accordion toggle
  container.querySelectorAll(".sport-header").forEach(function (header) {
    header.addEventListener("click", function () {
      header.parentElement.classList.toggle("open");
    });
  });
}

function buildTopAthletes(data) {
  var container = document.getElementById("top-athletes-list");
  if (!container) return;
  var html = "";
  data.forEach(function (row, idx) {
    var rank = idx + 1;
    var rankCls = rank <= 3 ? " athlete-rank--" + rank : "";
    var sportName = SPORT_FR[row.sport] || row.sport;
    var editions = row.editions.join(", ");
    var medals = buildMedalIcons(row.gold, row.silver, row.bronze, "athlete-medal-icon");

    html += '<div class="athlete-row">'
      + '<span class="athlete-rank' + rankCls + '">' + rank + "</span>"
      + '<span class="athlete-info">'
      + '<span class="athlete-name">' + row.athlete + "</span>"
      + '<span class="athlete-detail">' + sportName + " \u00b7 " + editions + "</span>"
      + "</span>"
      + '<span class="athlete-medals">' + medals + "</span>"
      + "</div>";
  });
  container.innerHTML = html;
}

function buildStats(containerId, key, dataByYear, currentYear) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const currentData = dataByYear[String(currentYear)];
  if (!currentData || currentData.length === 0) return;
  const lastDayCurrent = currentData[currentData.length - 1].day_index;
  const valCurrent = currentData[currentData.length - 1][key];

  function valueAtDay(data, day) {
    const row = data.find((r) => r.day_index === day);
    return row ? row[key] : null;
  }

  const label = medalLabel(key, valCurrent);

  const badgeCls = `stat-badge--${key}`;

  let html = `<p class="stat-paragraph">La France a remport\u00e9 <span class="stat-badge ${badgeCls}">${valCurrent} ${label}</span> pour le moment (J+${lastDayCurrent}).`;

  const parts = J0_COMPARISON_YEARS
    .filter((year) => year !== currentYear && dataByYear[String(year)])
    .map((year) => {
      const value = valueAtDay(dataByYear[String(year)], lastDayCurrent);
      return value !== null ? `${value} en ${year}` : null;
    })
    .filter((part) => part !== null);

  if (parts.length > 0) {
    html += `<span class="stat-past">C'\u00e9tait ${parts.join(", ").replace(/, ([^,]*)$/, " et $1")} \u00e0 la m\u00eame p\u00e9riode.</span>`;
  }

  html += `</p>`;
  container.innerHTML = html;
}

function setMeta(elementId, lines) {
  const container = document.getElementById(elementId);
  container.innerHTML = "";
  lines.forEach((line) => {
    const span = document.createElement("span");
    span.textContent = line;
    container.appendChild(span);
  });
}

async function init() {
  try {
    const editions = await loadJSON("../output/france_winter_medals_by_edition.json");
    buildEditionChart(editions);
    const totalAll = editions.reduce((s, r) => s + r.total, 0);
    const maxGold = Math.max(...editions.map((r) => r.gold));
    const maxSilver = Math.max(...editions.map((r) => r.silver));
    const maxBronze = Math.max(...editions.map((r) => r.bronze));
    const maxTotal = Math.max(...editions.map((r) => r.total));
    setMeta("meta-editions", [
      `${editions.length} \u00e9ditions`,
      `${totalAll} m\u00e9dailles au total`,
      `Record : ${maxTotal} m\u00e9dailles`,
      `Record par type : \ud83e\udd47 ${maxGold}  \ud83e\udd48 ${maxSilver}  \ud83e\udd49 ${maxBronze}`,
    ]);
  } catch (error) {
    setMeta("meta-editions", ["Impossible de charger les donn\u00e9es."]);
    console.error(error);
  }

  try {
    const loaded = await Promise.all(
      J0_COMPARISON_YEARS.map((year) =>
        loadJSON(`../output/medal_evolution_since_j0_${year}_FRA.json`).then((data) => [String(year), data])
      )
    );
    const dataByYear = {};
    loaded.forEach(([year, data]) => {
      dataByYear[year] = data;
    });
    const data2026 = dataByYear["2026"];

    const maxDay = Math.max(
      ...J0_COMPARISON_YEARS.map((year) => {
        const data = dataByYear[String(year)];
        return data[data.length - 1].day_index;
      })
    );
    const labels = Array.from({ length: maxDay + 1 }, (_, i) => `J+${i}`);

    function buildSeries(data, key) {
      const values = Array(maxDay + 1).fill(null);
      data.forEach((row) => { values[row.day_index] = row[key]; });
      return values;
    }

    function buildSeriesByMetric(key) {
      const byYear = {};
      J0_COMPARISON_YEARS.forEach((year) => {
        const data = dataByYear[String(year)];
        if (data) byYear[String(year)] = buildSeries(data, key);
      });
      return byYear;
    }

    const series = {
      total: buildSeriesByMetric("total"),
      gold: buildSeriesByMetric("gold"),
      silver: buildSeriesByMetric("silver"),
      bronze: buildSeriesByMetric("bronze"),
    };

    buildComparisonChart("chart-j0-total", labels, series.total, "Total", COLORS.total);
    buildComparisonChart("chart-j0-gold", labels, series.gold, "Or", COLORS.gold);
    buildComparisonChart("chart-j0-silver", labels, series.silver, "Argent", COLORS.silver);
    buildComparisonChart("chart-j0-bronze", labels, series.bronze, "Bronze", COLORS.bronze);

    const lastDay = data2026[data2026.length - 1];
    buildMedalShowcaseForType("medal-showcase-gold", "gold", lastDay.gold);
    buildMedalShowcaseForType("medal-showcase-silver", "silver", lastDay.silver);
    buildMedalShowcaseForType("medal-showcase-bronze", "bronze", lastDay.bronze);

    buildStats("stats-j0-total", "total", dataByYear, 2026);
    buildStats("stats-j0-gold", "gold", dataByYear, 2026);
    buildStats("stats-j0-silver", "silver", dataByYear, 2026);
    buildStats("stats-j0-bronze", "bronze", dataByYear, 2026);

    // Footer: last update based on most recent date in 2026 JSON
    const footerEl = document.getElementById("footer-update");
    if (footerEl) {
      const lastDate = data2026[data2026.length - 1].date;
      const d = new Date(lastDate + "T00:00:00");
      const opts = { day: "numeric", month: "long", year: "numeric" };
      footerEl.textContent = "Donn\u00e9es \u00e0 jour au " + d.toLocaleDateString("fr-FR", opts);
    }

  } catch (error) {
    setMeta("meta-j0", ["Impossible de charger les donn\u00e9es."]);
    console.error(error);
  }

  try {
    const sportData = await loadJSON("../output/france_winter_medals_by_sport.json");
    buildSportMedals(sportData);
  } catch (error) {
    console.error(error);
  }

  try {
    const athleteData = await loadJSON("../output/france_winter_top_athletes.json");
    buildTopAthletes(athleteData);
  } catch (error) {
    console.error(error);
  }

  injectExportButtons();
}

init();
