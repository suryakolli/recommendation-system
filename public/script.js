document.addEventListener("DOMContentLoaded", function () {
    const margin = { top: 30, right: 30, bottom: 50, left: 70 };
    const width = 600 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    const barData = [
        { month: "Jan", sales: 50 },
        { month: "Feb", sales: 65 },
        { month: "Mar", sales: 80 },
        { month: "Apr", sales: 55 },
        { month: "May", sales: 90 },
        { month: "Jun", sales: 120 },
        { month: "Jul", sales: 110 },
        { month: "Aug", sales: 100 },
        { month: "Sep", sales: 85 },
        { month: "Oct", sales: 95 },
        { month: "Nov", sales: 105 },
        { month: "Dec", sales: 130 }
    ];

    // Sample Data for Line Chart (Revenue per Day for a Month)
    const lineData = Array.from({ length: 30 }, (_, i) => ({
        day: i + 1,
        revenue: Math.floor(Math.random() * 1000) + 2000
    }));

    // Tooltip
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // Create SVG for Bar Chart
    const svgBar = d3.select("#barChart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales for Bar Chart
    const xBar = d3.scaleBand()
        .domain(barData.map(d => d.month))
        .range([0, width])
        .padding(0.2);

    const yBar = d3.scaleLinear()
        .domain([0, d3.max(barData, d => d.sales)])
        .nice()
        .range([height, 0]);

    // X Axis
    svgBar.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xBar));

    // Y Axis
    svgBar.append("g")
        .call(d3.axisLeft(yBar));

    // Bars with Tooltip
    svgBar.selectAll(".bar")
        .data(barData)
        .enter()
        .append("rect")
        .attr("x", d => xBar(d.month))
        .attr("y", d => yBar(d.sales))
        .attr("width", xBar.bandwidth())
        .attr("height", d => height - yBar(d.sales))
        .attr("fill", "steelblue")
        .on("mouseover", function (event, d) {
            d3.select(this).attr("fill", "orange");
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`Month: ${d.month}<br>Sales: ${d.sales}`)
                .style("left", event.pageX + "px")
                .style("top", event.pageY - 28 + "px");
        })
        .on("mousemove", function (event) {
            tooltip.style("left", event.pageX + "px")
                .style("top", event.pageY - 28 + "px");
        })
        .on("mouseout", function () {
            d3.select(this).attr("fill", "steelblue");
            tooltip.transition().duration(500).style("opacity", 0);
        });

    // Create SVG for Line Chart
    const svgLine = d3.select("#lineChart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales for Line Chart
    const xLine = d3.scaleLinear()
        .domain([1, 30])
        .range([0, width]);

    const yLine = d3.scaleLinear()
        .domain([d3.min(lineData, d => d.revenue), d3.max(lineData, d => d.revenue)])
        .nice()
        .range([height, 0]);

    // X Axis
    svgLine.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xLine).tickFormat(d3.format("d")));

    // Y Axis
    svgLine.append("g")
        .call(d3.axisLeft(yLine));

    // Line Path
    const line = d3.line()
        .x(d => xLine(d.day))
        .y(d => yLine(d.revenue))
        .curve(d3.curveMonotoneX);

    svgLine.append("path")
        .datum(lineData)
        .attr("fill", "none")
        .attr("stroke", "red")
        .attr("stroke-width", 2)
        .attr("d", line);

    // Data Points with Tooltip
    svgLine.selectAll(".dot")
        .data(lineData)
        .enter()
        .append("circle")
        .attr("cx", d => xLine(d.day))
        .attr("cy", d => yLine(d.revenue))
        .attr("r", 4)
        .attr("fill", "red")
        .on("mouseover", function (event, d) {
            d3.select(this).attr("r", 6).attr("fill", "blue");
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`Day: ${d.day}<br>Revenue: $${d.revenue}`)
                .style("left", event.pageX + "px")
                .style("top", event.pageY - 28 + "px");
        })
        .on("mousemove", function (event) {
            tooltip.style("left", event.pageX + "px")
                .style("top", event.pageY - 28 + "px");
        })
        .on("mouseout", function () {
            d3.select(this).attr("r", 4).attr("fill", "red");
            tooltip.transition().duration(500).style("opacity", 0);
        });
});
