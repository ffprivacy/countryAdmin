class Guard {

    constructor() {
        this.selected_metric = null;
        this.state = null;
        this.areas = [];
        this.puzzleChart = null;
        this.tradeChart = null;
    }

    static async areaFetchAllData(areaData) {
        const area = await fetchAreaAPI('/area', undefined, areaData);
        area['trades'] = await fetchAreaAPI('/trades', undefined, areaData);
        area['metrics'] = await fetchAreaAPI('/metrics', undefined, areaData);
        area['processes'] = await fetchAreaAPI('/processes', undefined, areaData);
        return area;
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
        for(let area_uri of this.state.area_uris) {
            let areaData = {};
            if ( IS_LOCAL_AREA_REGEX(area_uri) ) {
                areaData['id'] = parseInt(area_uri);
            } else {
                areaData['uri'] = area_uri;
            }
            this.areas.push(await Guard.areaFetchAllData(areaData));
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
                <td><a target="_blank" href="${area_dashboard_url(area)}">${area.name}</a></td>
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

    async area_retrieve(uri, id) {
        let area = this.areas.find((area) => area.id == id);
        if ( ! area ) {
            area = await Guard.areaFetchAllData({uri: uri, id: id});
            this.areas.push(area);
        }
        return area;
    }

    area_net_flow(area, metric) {
        return area.metrics.flow.output[metric] - area.metrics.flow.input[metric];
    }

    flowGraphShowModal(nodeData) {
        const modal = new bootstrap.Modal(document.getElementById('nodeDetailModal'), {});
        const metricObj = Processes.metricsGetList().find((o) => o.id == this.selected_metric);
        document.getElementById('nodeDetailModalLabel').innerText = `Area ${nodeData.name} - ${metricObj.label}:`;
        document.getElementById('nodeDetailModalBody').innerHTML = `
            <p><strong>Name:</strong> ${nodeData.name}</p>
            <p><strong>${metricObj.label}:</strong> ${nodeData.metricValue} ${metricObj.unit}</p>
        `;
        modal.show();
    }

    async flowGraphUpdate() {

        const title = document.getElementById("flowGraphTitle");
        const metricObj = Processes.metricsGetList().find((o) => o.id == this.selected_metric);
        title.innerHTML = `
            <h3><img src="/static/${metricObj == undefined ? '' : metricObj.icon}" class="ms-2" style="max-width: 50px;" />${this.selected_metric} flow and amount per area</h3>
        `;
        const _this = this;
    
        const cy = cytoscape({
            container: document.getElementById('flowGraph'),
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#1f77b4',
                        'label': 'data(name)',
                        'width': 'mapData(radius, 0, 10, 10, 50)',
                        'height': 'mapData(radius, 0, 10, 10, 50)'
                    }
                },
                {
                    selector: 'node:parent',
                    style: {
                        'background-color': '#ffcc00',
                        'border-color': '#000',
                        'border-width': 2,
                        'label': 'data(name)'
                    }
                },
                {
                    selector: 'node.expanded',
                    style: {
                        'background-color': '#ffa500',
                        'border-color': '#ff0000',
                        'border-width': 2
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#999'
                    }
                }
            ],
            layout: {
                name: 'cose'
            }
        });
    
        function genGraphId(uri, area_id) {
            const uri_parsed = URL.parse(uri);
            if (uri == null || uri == undefined) {
                return `${area_id}`;
            } else if (area_id == null || area_id == undefined) {
                if ( uri_parsed != null && uri_parsed.origin == HOME_HOST_URI() ) {
                    return '1';
                } else {
                    return `${uri}`;
                }
            } else {
                if ( URL.parse(uri).origin == HOME_HOST_URI() ) {
                    return `${area_id}`;
                } else {
                    return `${uri} - ${area_id}`;
                }
            }
        }

        function buildNodeFor(area) {
            let metricValue = _this.area_net_flow(area, _this.selected_metric);
            metricValue = isNaN(metricValue) ? 0 : metricValue < 0 ? 0 : metricValue;
            return {
                data: {
                    id: genGraphId(area.uri, area.id),
                    name: area.name,
                    radius: Math.log(metricValue + 1),
                    metricValue: metricValue,
                    area: area
                },
                position: { x: Math.random() * 800, y: Math.random() * 600 }
            }
        }

        function buildEdgeFor(area,trade) {
            if ( area.id == trade.home_area_id || area.id == trade.remote_area_id 
                || IS_LOCAL_AREA_REGEX(area.uri) && ( 
                    parseInt(area.uri) == trade.home_area_id || parseInt(area.uri) == trade.remote_area_id
                )
            ) {
                const sourceId = genGraphId(area.uri, area.id);
                const targetId = genGraphId(trade.remote_host_uri, trade.remote_area_id);

                console.info("should set a weight based on processes");
                return { data: { source: sourceId, target: targetId } };
            }
        }

        let nodes = [];
        let edges = [];
        for (let area of this.areas) {
            nodes.push(buildNodeFor(area));
            for (let trade of area.trades) {
                const edge = buildEdgeFor(area,trade);
                if ( edge ) {
                    edges.push(edge);
                }
            }
        }

        function flowGraphAppendData(cy,nodes,edges) {
            cy.add(nodes);
            let newNodeIds = new Set(nodes.map(node => node.data.id));
            let existingNodeIds = new Set(cy.nodes().map(node => node.id()));
            let nodeIds = new Set([...existingNodeIds, ...newNodeIds]);

            edges = edges.filter(edge => nodeIds.has(edge.data.source) && nodeIds.has(edge.data.target));
            cy.add(edges);
        
            cy.nodes().each(function(node) {

                if (!node.data('flowGraphEventsAttached')) {
                    
                    node.on('dblclick', function (event) {
                        event.stopPropagation();
                        event.preventDefault();
                        _this.flowGraphShowModal(event.target.data());
                    });
                
                    node.on('cxttap', function (event) {
                        const node = event.target;
                        if (node.hasClass('expanded')) {
                            collapseNode(node);
                        } else {
                            expandNode(node);
                        }
                    });
                    
                    node.data('flowGraphEventsAttached', true);
                }
            });

        }
        
        flowGraphAppendData(cy,nodes,edges);

        async function expandNode(node) {
            node.addClass('expanded');
            const area = node.data('area');
            let nodes = [];
            let edges = [];
            const node_id = node.id();

            for(let composition of area.compositions) {
                const child_area = await _this.area_retrieve(area.uri, composition.id);
                const newNode = buildNodeFor(child_area);
                newNode.data.parent = node_id;
                nodes.push(newNode);
                for (let trade of child_area.trades) {
                    const edge = buildEdgeFor(child_area,trade);
                    if ( edge ) {
                        edges.push(edge);
                    }
                }
            }

            flowGraphAppendData(cy,nodes,edges);
    
            node.style('background-color', '#ffa500'); // Adjust the color
            cy.layout({ name: 'cose' }).run();
        }
    
        function collapseNode(node) {
            node.removeClass('expanded');
            const area = node.data('area');
            const compositions = area.compositions.map(compo => genGraphId(area.uri, compo.id));
            cy.remove(cy.nodes().filter(n => compositions.includes(n.id())));
            node.style('background-color', '#1f77b4'); // Restore the original color
            cy.layout({ name: 'cose' }).run();
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
    let areaData = {};
    if ( IS_LOCAL_AREA_REGEX(area_uri) ) {
        areaData['id'] = parseInt(area_uri);
    } else {
        areaData['uri'] = area_uri;
    }
    fetchAreaAPI('/set_process',{
        method: 'POST',
        body: JSON.stringify(process)
    },areaData)
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
    selectElement.value = 'envEmissions';
    guard.selected_metric = selectElement.value;
    guard.refresh();
});

document.getElementById('metric-select').addEventListener('change', function() {
    guard.selected_metric = this.value;
    guard.refresh();
});