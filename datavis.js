import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

const margin = { top: 20, right: 30, bottom: 50, left: 50 };
const width = 800 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

const svg = d3.select("#chart")
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("#tooltip");

// ---------- LOAD & MERGE DATA ----------

// tas: month, lat, tas
const tasData = await d3.csv("data/tas_vs_lat_2010.csv", d => ({
  month: +d.month,
  lat: +d.lat,
  tas: +d.tas
}));

// o3: month, lat, plev, o3
const o3Data = await d3.csv("data/o3_vs_lat_2010.csv", d => ({
  month: +d.month,
  lat: +d.lat,
  plev: +d.plev,
  o3: +d.o3
}));

// psl: month, lat, psl
const pslData = await d3.csv("data/psl_vs_lat_2010.csv", d => ({
  month: +d.month,
  lat: +d.lat,
  psl: +d.psl
}));

// Merge by (month, lat)
const mergedMap = new Map();
const key = (month, lat) => `${month}|${lat}`;

tasData.forEach(d => {
  const k = key(d.month, d.lat);
  if (!mergedMap.has(k)) mergedMap.set(k, { month: d.month, lat: d.lat });
  mergedMap.get(k).tas = d.tas;
});

o3Data.forEach(d => {
  const k = key(d.month, d.lat);
  if (!mergedMap.has(k)) mergedMap.set(k, { month: d.month, lat: d.lat });
  mergedMap.get(k).o3 = d.o3;
  mergedMap.get(k).plev = d.plev;
});

pslData.forEach(d => {
  const k = key(d.month, d.lat);
  if (!mergedMap.has(k)) mergedMap.set(k, { month: d.month, lat: d.lat });
  mergedMap.get(k).psl = d.psl;
});

const data = Array.from(mergedMap.values());

// ---------- SLIDER + VARIABLE SELECT ----------

const months = [...new Set(data.map(d => d.month))].sort((a, b) => a - b);
const sliderWidth = 900;

const slider = d3.select("#month")
  .append("input")
  .attr("type", "range")
  .attr("min", d3.min(months))
  .attr("max", d3.max(months))
  .attr("step", 1)
  .attr("value", d3.min(months))
  .attr("class", "slider")
  .style("width", sliderWidth + "px")
  .style("display", "block")
  .style("margin", "0 auto");

const labelContainer = d3.select("#month")
  .append("div")
  .attr("class", "slider-labels")
  .style("display", "flex")
  .style("justify-content", "space-between")
  .style("width", "75%")
  .style("margin", "0 auto")
  .style("font-size", "0.9rem");

labelContainer.selectAll("span")
  .data(months)
  .join("span")
  .text(d => new Date(2000, d - 1).toLocaleString("default", { month: "short" }));

/*const tickList = d3.select("#month")
  .append("datalist")
  .attr("id", "monthTicks");

slider.attr("list", "monthTicks");

tickList.selectAll("option")
  .data(months)
  .join("option")
  .attr("value", d => d)
  .text(d => new Date(2000, d - 1).toLocaleString("default", { month: "short" }));

const label = d3.select("#month")
  .append("div")
  .attr("id", "monthLabel")
  .style("margin-top", "10px")
  .text(new Date(2000, d3.min(months) - 1).toLocaleString("default", { month: "long" }));*/
const monthNames = months.map(m =>
  new Date(2000, m - 1).toLocaleString("default", { month: "short" })
);

// add tick labels under the slider manually
const sliderScale = d3.scaleLinear()
  .domain([1, 12])
  .range([0, sliderWidth]);

const tickSvg = d3.select("#month")
  .append("svg")
  .attr("width", sliderWidth)
  .attr("height", 40);

tickSvg.selectAll("text")
  .data(monthNames)
  .join("text")
  .attr("x", (_, i) => sliderScale(i + 1))
  .attr("y", 20)
  .attr("text-anchor", "middle")
  .attr("font-size", "12px")
  .attr("fill", "#333")
  .text(d => d);

// dropdown to switch tas/o3/psl
let currentVariable = "tas";

const variableSelect = d3.select("#month")
  .append("select")
  .attr("id", "variableSelect")
  .style("margin-top", "10px")
  .on("change", function () {
    currentVariable = this.value;
    const monthValue = +slider.property("value");
    draw(monthValue);
  });

variableSelect.selectAll("option")
  .data([
    { value: "tas", label: "Surface Temperature (tas)" },
    { value: "o3", label: "Ozone (o3)" },
    { value: "psl", label: "Sea Level Pressure (psl)" }
  ])
  .join("option")
  .attr("value", d => d.value)
  .text(d => d.label);

slider.on("input", function () {
  const monthValue = +this.value;
  label.text(new Date(2000, monthValue - 1).toLocaleString("default", { month: "long" }));
  draw(monthValue);
});

// ---------- SCALES & AXES ----------

const xScale = d3.scaleLinear().domain([-90, 90]).range([0, width]);
const yScale = d3.scaleLinear().range([height, 0]);

const xAxis = d3.axisBottom(xScale);
const yAxis = d3.axisLeft(yScale);

svg.append("g")
  .attr("class", "x-axis")
  .attr("transform", `translate(0,${height})`)
  .call(xAxis)
  .append("text")
  .attr("x", width / 2)
  .attr("y", 40)
  .attr("fill", "black")
  .attr("text-anchor", "middle")
  .text("Latitude");

const yAxisG = svg.append("g")
  .attr("class", "y-axis")
  .call(yAxis);

const yLabel = yAxisG.append("text")
  .attr("transform", "rotate(-90)")
  .attr("x", -height / 2)
  .attr("y", -40)
  .attr("fill", "black")
  .attr("text-anchor", "middle")
  .text("Surface Temperature (°C)"); // default tas

function yLabelText(variable) {
  if (variable === "tas") return "Surface Temperature (°C)";
  if (variable === "o3") return "Ozone (O₃)";
  if (variable === "psl") return "Sea Level Pressure";
  return variable;
}

// ---------- DRAW FUNCTION ----------

function draw(month) {
  const monthData = data.filter(d => d.month === month);
  const yVar = currentVariable;

  const filtered = monthData.filter(d => d[yVar] !== undefined && !Number.isNaN(d[yVar]));
  if (filtered.length === 0) {
    console.warn(`No data for ${yVar} in month ${month}`);
    return;
  }

  // Update y-scale based on selected variable
  yScale.domain(d3.extent(filtered, d => d[yVar])).nice();
  svg.select(".y-axis").transition().duration(500).call(yAxis);
  yLabel.text(yLabelText(yVar));

  const line = d3.line()
    .x(d => xScale(d.lat))
    .y(d => yScale(d[yVar]));

  svg.selectAll(".line").data([filtered])
    .join("path")
    .attr("class", "line")
    .transition()
    .duration(500)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 2)
    .attr("d", line);

  const circles = svg.selectAll("circle").data(filtered, d => d.lat);

  circles.join(
    enter => enter.append("circle")
      .attr("cx", d => xScale(d.lat))
      .attr("cy", d => yScale(d[yVar]))
      .attr("r", 4)
      .attr("fill", "orange")
      .on("mouseenter", (event, d) => {
        const fmt = v =>
          v === undefined || Number.isNaN(v) ? "NA" :
          Math.abs(v) > 1e3 ? v.toExponential(2) : v.toFixed(3);

        tooltip
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY}px`)
          .html(`
            Lat: ${d.lat}°<br>
            tas: ${d.tas !== undefined ? d.tas.toFixed(2) : "NA"} °C<br>
            o3: ${d.o3 !== undefined ? fmt(d.o3) : "NA"}<br>
            psl: ${d.psl !== undefined ? fmt(d.psl) : "NA"}<br>
            <i>Currently plotting: ${yVar}</i>
          `)
          .attr("hidden", null);
      })
      .on("mouseleave", () => tooltip.attr("hidden", true)),
    update => update
      .transition()
      .duration(500)
      .attr("cx", d => xScale(d.lat))
      .attr("cy", d => yScale(d[yVar])),
    exit => exit.remove()
  );
}

// initial draw
draw(months[0]);
