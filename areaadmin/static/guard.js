class Guard {

    constructor() {
        this.selected_metric = null;
        this.state = null;
        this.areas = [];
        this.puzzleChart = null;
        this.tradeChart = null;
    }

    async refresh() {
        this.state = await fetchAreaAPI('/guard');
        
        document.getElementById("guard-last-seen").innerText = this.state.last_check_date;
        let guardAlerts = document.getElementById("guard-alerts");
        guardAlerts.innerHTML = '';
        for(let alert of this.state.alerts) {
            let alertElement = document.createElement("div");
            alertElement.className = "guard-alert card card-body";
            alertElement.innerHTML = `
                <div class="guard-alert-title">${alert.title} - ${alert.time}</div>
                <div class="guard-alert-description">${alert.description}</div>
            `;
            if ( alert.title.match("pollution") ) {
                const match = alert.description.match(/amount=(\d+)/);
                const amount = match ? parseInt(match[1]) : null;
                if (amount == null) {
                    console.warn("no amount provided");
                } else {
                    alertElement.innerHTML += `
                        <button onclick="clearPollutionDebt(${alert.id},'${alert.area}',${amount})" class="btn btn-primary mt-2">Clear the debt</div>
                    `;
                }
            }
            guardAlerts.appendChild(alertElement);
        }

        const currentArea = await fetchAreaAPI('/area');
        document.getElementById("guard-title").innerText = ` - ${currentArea.name}`;

        this.areas = [];
        for(let uri of this.state.area_uris) {
            const area = await fetchAreaAPI('/area', undefined, uri);
            area['trades'] = await fetchAreaAPI('/trades', undefined, uri);
            area['metrics'] = await fetchAreaAPI('/metrics', undefined, uri);
            area['uri'] = uri;
            this.areas.push(area);
        }
    
        this.updateTable();
        this.updateCharts();
    }

    updateTable() {
        const tableBody = document.getElementById('area-table');
        tableBody.innerHTML = '';
    
        this.areas.forEach(area => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><a target="_blank" href="${dashboard_area_generate_uri_from_database(area.uri)}">${area.name}</a></td>
                <td>${area.metrics.flow.output[this.selected_metric]}</td>
                <td>${area.metrics.resources_depletion[this.selected_metric]}</td>
                <td><button class="btn btn-primary">Details</button></td>
            `;
            tableBody.appendChild(row);
        });
    };
    
    updateCharts() {
        const labels = this.areas.map(area => area.name);
    
        {
            const data = this.areas.map(area => area.metrics.flow.output[this.selected_metric]);
            if ( this.puzzleChart == null ) {
                const ctxPuzzle = document.getElementById('puzzleChart').getContext('2d');
                this.puzzleChart = new Chart(ctxPuzzle, {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Metric Comparison',
                            data: data,
                            backgroundColor: ['red', 'blue', 'green'],
                        }]
                    }
                });
            } else {
                this.puzzleChart.data.labels = labels;
                this.puzzleChart.data.datasets.forEach((dataset) => {
                    dataset.data = data;
                });
                this.puzzleChart.update();
            }
        }
    
        {
            const data = this.areas.map(area => area.metrics.resources_depletion[this.selected_metric]);
            if ( this.tradeChart == null ) {
                const ctxTrade = document.getElementById('tradeChart').getContext('2d');
                this.tradeChart = new Chart(ctxTrade, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Trade Volume',
                            data: data,
                            backgroundColor: ['purple', 'orange', 'yellow'],
                        }]
                    }
                });
            } else {
                this.tradeChart.data.labels = labels;
                this.tradeChart.data.datasets.forEach((dataset) => {
                    dataset.data = data;
                });
                this.tradeChart.update();
            }
        }
    
        this.flowGraphUpdate();
    
    }
    
    flowGraphUpdate() {
        const svg = d3.select('#graphSvg');
        svg.selectAll('*').remove();
    
        const width = +svg.attr('width');
        const height = +svg.attr('height');
    
        function genGraphId(uri, area_id) {
            if (uri == null || uri == undefined) {
                return `${area_id}`;
            } else if (area_id == null || area_id == undefined) {
                return `${uri}`;
            } else {
                return `${uri} - ${area_id}`;
            }
        }
    
        const nodes = this.areas.map((area, index) => ({
            id: genGraphId(area.uri, area.id),
            radius: area.metrics.flow.output[this.selected_metric] - area.metrics.flow.input[this.selected_metric],
            name: area.name,
            area: area
        }));
    
        const maxRadius = d3.max(nodes, d => d.radius);
        nodes.forEach(node => node.radius = Math.log(node.radius + 1) / Math.log(maxRadius + 1) * 10);
            
        const graphEdges = [];
        for (let area of this.areas) {
            for (let trade of area.trades) {
                graphEdges.push({
                    source: genGraphId(area.uri, area.id),
                    target: genGraphId(trade.remote_host_uri, trade.remote_area_id),
                    value: 2
                });
            }
        }
    
        const zoom = d3.zoom()
            .scaleExtent([1, 10])
            .on('zoom', (event) => {
                svgGroup.attr('transform', event.transform);
            });
    
        svg.call(zoom);
    
        const svgGroup = svg.append('g');
    
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(graphEdges).id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-50))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(d => d.radius + 5));
    
        const link = svgGroup.append('g')
            .attr('stroke', '#999')
            .selectAll('line')
            .data(graphEdges)
            .join('line')
            .attr('stroke-width', d => d.value * 0.1);
    
        const node = svgGroup.append('g')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .selectAll('circle')
            .data(nodes)
            .join('circle')
            .attr('r', d => isNaN(d.radius) ? 0 : d.radius )
            .attr('fill', this.flowGraphColorNode)
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended))
            .on('click', function(event, d) {
                showModal(d);
            });
    
        node.append('title')
            .text(d => d.name);
    
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
    
            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
        });
    
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
    
        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
    
        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
    
        function showModal(nodeData) {
            const modal = new bootstrap.Modal(document.getElementById('nodeDetailModal'), {});
            document.getElementById('nodeDetailModalLabel').innerText = `Node Details: ${nodeData.name}`;
            document.getElementById('nodeDetailModalBody').innerHTML = `
                <p><strong>Name:</strong> <a href="${dashboard_area_generate_uri_from_database(nodeData.area.uri)}" target="_blank">${nodeData.name}</a></p>
                <p><strong>Metric relative strength:</strong> ${nodeData.radius}</p>
            `;
            modal.show();
        }
    }
}

const guard = new Guard()

document.getElementById('search-area').addEventListener('keyup', function() {
    const searchValue = this.value.toLowerCase();
    const rows = document.querySelectorAll('#area-table tr');
    rows.forEach(row => {
        const areaName = row.querySelector('td').textContent.toLowerCase();
        row.style.display = areaName.includes(searchValue) ? '' : 'none';
    });
});

function guardClearAlerts() {
    fetchAreaAPI('/guard/alerts/clear').then(response => {
        guard.refresh()
    })
}
function clearPollutionDebt(alert_id, remote_area, emissionEnv=90) {
    const remote_uri = area_api_generate_from_database(remote_area);
    const process = {
        title: 'Remote area has capability and proposed to absorbe your emissions',
        description: 'Clear your emissions debt (overpollution)',
        metrics: {
            input: {
                envEmissions: emissionEnv,
                economic: 90
            },
            output: {
                envEmissions: emissionEnv,
                economic: 90
            }
        }
    }
    fetchAreaAPI('/set_process',{
        method: 'POST',
        body: JSON.stringify(process)
    },remote_uri)
    .then(response => {
        const tradeData = {
            remote_host_uri: remote_area,
            remote_processes: response.processes.map(obj => ({id: obj.id, amount: 1}))
        };
        fetchAreaAPI('/trade',{
            method: 'POST',
            body: JSON.stringify(tradeData)
        }).then(async function (response) {
            await fetchAreaAPI(`/guard/alert/${alert_id}`,{method: 'DELETE'})
            guard.refresh()
        })
    })
}

document.getElementById('add-area-btn').addEventListener('click', function() {
    const newUri = document.getElementById('new-area-uri').value.trim();
    if (newUri) {
        document.getElementById('new-area-uri').value = '';

        fetchAreaAPI('/guard/subscribe',{
			method: 'POST',
			body: JSON.stringify({
				uri: newUri
			})
		}).then(response => {
            guard.refresh();
        })
    }
});

document.getElementById('refresh-btn').addEventListener('click', function() {
    guard.refresh();
});

document.addEventListener('DOMContentLoaded', async () => {
    const metrics = await Processes.fetchMetricsGetList();
    const selectElement = document.getElementById('metric-select');

    selectElement.innerHTML = '';

    metrics.forEach(metric => {
        const option = document.createElement('option');
        option.value = metric.id;
        option.textContent = metric.id;
        selectElement.appendChild(option);
    });
    guard.refresh();
});

document.getElementById('metric-select').addEventListener('change', function() {
    guard.selected_metric = this.value;
    guard.refresh();
});