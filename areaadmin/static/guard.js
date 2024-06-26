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
        const svg = d3.select('#flowGraph');
        svg.selectAll('*').remove();
        const title = document.getElementById("flowGraphTitle");
        const metricObj = Processes.metricsGetList().find((o) => o.id == this.selected_metric);
        title.innerHTML = `
            <h3><img src="/static/${metricObj == undefined ? '' : metricObj.icon}" class="ms-2" style="max-width: 50px;" />${this.selected_metric} flow and amount per area</h3>
        `;
    
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
    
        let nodes = this.areas.map((area, index) => ({
            id: genGraphId(area.uri, area.id),
            radius: area.metrics.flow.output[this.selected_metric] - area.metrics.flow.input[this.selected_metric],
            metricValue: area.metrics.flow.output[this.selected_metric] - area.metrics.flow.input[this.selected_metric],
            name: area.name,
            area: area,
            expanded: false
        }));
    
        const maxRadius = d3.max(nodes, d => d.radius);
        nodes.forEach(node => node.radius = Math.log(node.radius + 1) / Math.log(maxRadius + 1) * 10);
    
        let nodeIds = new Set(nodes.map(node => node.id));
    
        let graphEdges = [];
        for (let area of this.areas) {
            for (let trade of area.trades) {
                const sourceId = genGraphId(area.uri, area.id);
                const targetId = genGraphId(trade.remote_host_uri, trade.remote_area_id);
    
                if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
                    graphEdges.push({
                        source: sourceId,
                        target: targetId,
                        value: 2
                    });
                }
            }
        }
    
        const zoom = d3.zoom()
            .scaleExtent([1, 10])
            .on('zoom', (event) => {
                svgGroup.attr('transform', event.transform);
            });
    
        svg.call(zoom);
    
        const svgGroup = svg.append('g');
    
        let simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(graphEdges).id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-50))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(d => d.radius + 5));
    
        let link = svgGroup.append('g')
            .attr('stroke', '#999')
            .selectAll('line')
            .data(graphEdges)
            .join('line')
            .attr('stroke-width', d => d.value * 0.1);
    
        let node = svgGroup.append('g')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .selectAll('circle')
            .data(nodes)
            .join('circle')
            .attr('r', d => isNaN(d.radius) ? 0 : d.radius)
            .attr('fill', this.flowGraphColorNode)
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended))
            .on('dblclick', function(event, d) {
                showModal(d);
            })
            .on('contextmenu', function(event, d) {
                event.preventDefault();
                if (d.expanded) {
                    collapseNode(d);
                } else {
                    expandNode(d);
                }
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
    
        const this_selected_metric = this.selected_metric;
        function showModal(nodeData) {
            const modal = new bootstrap.Modal(document.getElementById('nodeDetailModal'), {});
            const metricObj = Processes.metricsGetList().find((o) => o.id == this_selected_metric);
            document.getElementById('nodeDetailModalLabel').innerText = `Area ${nodeData.name} - ${metricObj.label}:`;
            document.getElementById('nodeDetailModalBody').innerHTML = `
                <p><strong>Name:</strong> <a href="${dashboard_area_generate_uri_from_database(nodeData.area.uri)}" target="_blank">${nodeData.name}</a></p>
                <p><strong>${metricObj.label}:</strong> ${nodeData.metricValue} ${metricObj.unit}</p>
            `;
            modal.show();
        }
    
        function expandNode(nodeData) {
            nodeData.expanded = true;
            const compositions = nodeData.area.compositions;
            console.warn(nodeData.area);
            const newNodes = compositions.map(compo => ({
                id: genGraphId(null, compo.id),
                radius: compo.metrics[this_selected_metric],
                metricValue: compo.metrics[this_selected_metric],
                name: `Compo ${compo.id}`,
                area: nodeData.area,
                expanded: false
            }));
            nodes = nodes.concat(newNodes);
            nodeIds = new Set(nodes.map(node => node.id));
            simulation.nodes(nodes);
    
            const newEdges = newNodes.map(newNode => ({
                source: nodeData.id,
                target: newNode.id,
                value: 2
            }));
            graphEdges = graphEdges.concat(newEdges);
            simulation.force('link').links(graphEdges);
    
            updateGraph();
        }
    
        function collapseNode(nodeData) {
            nodeData.expanded = false;
            const compositions = nodeData.area.compositions.map(compo => genGraphId(null, compo.id));
            nodes = nodes.filter(node => !compositions.includes(node.id));
            nodeIds = new Set(nodes.map(node => node.id));
            simulation.nodes(nodes);
    
            graphEdges = graphEdges.filter(edge => edge.source.id !== nodeData.id && !compositions.includes(edge.target.id));
            simulation.force('link').links(graphEdges);
    
            updateGraph();
        }
    
        function updateGraph() {
            link = link.data(graphEdges);
            link.exit().remove();
            link = link.enter().append('line').attr('stroke-width', d => d.value * 0.1).merge(link);
    
            node = node.data(nodes);
            node.exit().remove();
            node = node.enter().append('circle')
                .attr('r', d => isNaN(d.radius) ? 0 : d.radius)
                .attr('fill', this.flowGraphColorNode)
                .call(d3.drag()
                    .on('start', dragstarted)
                    .on('drag', dragged)
                    .on('end', dragended))
                .on('dblclick', function(event, d) {
                    showModal(d);
                })
                .on('contextmenu', function(event, d) {
                    event.preventDefault();
                    if (d.expanded) {
                        collapseNode(d);
                    } else {
                        expandNode(d);
                    }
                })
                .merge(node);
    
            simulation.alpha(1).restart();
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
    },remote_area)
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
    selectElement.value = 'envEmissions';

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