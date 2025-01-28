async function fill_subzones(area) {
    const subzones = document.getElementById("area-subareas-list");
    subzones.innerHTML = '';
    let compositions = await Promise.all(area.compositions.map(async function(composition) {
        return await fetchAreaAPI('/area',undefined, {id: composition['id']});
    }));
    for(let composition of compositions) {
        let childElement = document.createElement('div');
        childElement.className = "card card-body";
        let childUri = area_dashboard_url(composition);
        childElement.innerHTML = `
            <div><a href="${childUri}" target="_blank">${composition.name}</a></div>
            <div>${composition.description}</div>
        `;
        subzones.appendChild(childElement);
    }
    {
        const width = 800;
        const height = 600;
        const scale = 0.05; // Scale factor for square area

        // Sample data: countries with surface area (in million square kilometers)
        const areas = compositions.map((composition) => ({name: composition.name, surface: composition.resources.ground.amount, url: area_dashboard_url(composition)}))

        // Calculate the total surface area to create a reasonable layout
        const totalArea = areas.reduce((acc, area) => acc + area.surface, 0);
        const numAreas = areas.length;
        const gridSize = Math.sqrt(numAreas); // Estimate grid size for better packing

        // Create an SVG container
        const svg = d3.select("#area-subareas-graph").append("svg")
            .attr("width", width)
            .attr("height", height);

        // Define square size based on the area (scaled)
        const maxArea = Math.max(...areas.map(d => d.surface)); // Max area for scaling

        // Define the position of squares based on a grid layout
        const squareSize = Math.min(width, height) / gridSize;
        
        // Predefined color list
        const colorList = ['red', 'green', 'blue', 'black', 'yellow'];

        // Function to pick a color from the color list
        function pickColor(i) {
            return colorList[i % colorList.length];
        }

        // Create squares for each country
        svg.selectAll(".area-subareas-graph-area-square")
            .data(areas)
            .enter().append("rect")
            .attr("class", "area-subareas-graph-area-square")
            .attr("x", (d, i) => (i % gridSize) * squareSize)
            .attr("y", (d, i) => Math.floor(i / gridSize) * squareSize)
            .attr("width", d => Math.sqrt(d.surface / maxArea) * squareSize)
            .attr("height", d => Math.sqrt(d.surface / maxArea) * squareSize)
            .attr("rx", 5)  // Rounded corners for squares
            .attr("ry", 5)
            .attr("fill", (d, i) => pickColor(i));

        // Add labels to squares (country names)
        svg.selectAll("text")
            .data(areas)
            .enter().append("text")
            .attr("x", (d, i) => (i % gridSize) * squareSize + Math.sqrt(d.surface / maxArea) * squareSize / 2)
            .attr("y", (d, i) => Math.floor(i / gridSize) * squareSize + Math.sqrt(d.surface / maxArea) * squareSize / 2)
            .text(d => d.name)
            .style("font-size", "10px")
            .style("fill", "white")
    }
}