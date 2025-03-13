// dashboard.js
let radarChart;
function updateRadarChart(economic, envEmissions, social) {
	const ctx = document.getElementById('metricsRadarChart').getContext('2d');
	if (radarChart) {
		radarChart.destroy();
	}
	radarChart = new Chart(ctx, {
		type: 'radar',
		data: {
			labels: ['Economic', 'Environmental', 'Social'],
			datasets: [{
				label: 'Definition du pays',
				data: [economic, envEmissions, social],
				backgroundColor: 'rgba(54, 162, 235, 0.2)',
				borderColor: 'rgba(54, 162, 235, 1)',
				borderWidth: 1
			}]
		},
		options: {
			maintainAspectRatio: false,
			responsive: true,
			scale: {
				beginAtZero: true,
				min: 0,
				ticks: { 
					beginAtZero: true,
					callback: function(value) {
						return Number(value.toString());
					} 
				}
			},
			elements: {
				line: {
					tension: 0
				}
			}
		}
	});
}
function dashboardRefresh() {
    return fetchAreaAPI('/processes')
        .then(async function (data) {
            const processList = document.getElementById('process-list');
            const allProcesses = data;
            processList.innerHTML = '';

			document.getElementById("process-list-number").innerText = `${allProcesses.length} processes`;
			document.getElementById("process-list-amount").innerText = `${allProcesses.reduce(function (accumulator, process) {
				for(let composition of process.composition) {
					accumulator += composition.amount * process.amount;
				}
				return accumulator + process.amount;
			}, 0)} process used`;

            fetchAreaAPI('/metrics')
            .then(metrics => {
                const areaMetrics = metrics.flow;
                const resourcesDepletion = metrics.resources_depletion;

                allProcesses.forEach(process => {
                    processList.appendChild(processCreateElement(allProcesses,process));
                });

                for (let sens of ['input', 'output']) {
                    const container = document.getElementById(`area-resource-total-${sens}`);
                    Processes.metricsGetList().forEach(metric => {
                        const id = `area-resource-total-${sens}-${metric.id}`;
                        let element = document.getElementById(id);
                        if (!element) {
                            element = document.createElement('div');
                            element.className = "col-6 col-md-6 card card-body";
                            element.id = id;
                            container.appendChild(element);
                        }
                        element.innerHTML = `<p>${metric.label}: <span>${areaMetrics[sens][metric.id]}</span> ${metric.unit}</p>`;
                    });
                }

                const containerDepletion = document.getElementById("area-resource-depletion");
                Processes.metricsGetList().forEach(metric => {
                    const id = `area-resources-depletion-time-${metric.id}-container`;
                    let element = document.getElementById(id);
                    if (!element) {
                        element = document.createElement('div');
                        element.className = "col-6 col-md-6 card card-body";
                        element.id = id;
                        containerDepletion.appendChild(element);
                    }
                    element.innerHTML = `<p>${metric.label}: <span>${resourcesDepletion[metric.id] == Infinity ? "∞" : resourcesDepletion[metric.id]}</span></p>`;
                });

                updateRadarChart(areaMetrics['output'].economic, areaMetrics['input'].envEmissions - areaMetrics['output'].envEmissions, areaMetrics['output'].social);

				fetchAreaAPI('/area')
				.then(async function(area) {
					
					const pageTitle = document.getElementById("dashboard-title");
					pageTitle.innerText = ` - ${area.name}`;

					const areaTitle = document.getElementById("area-data-title");
					areaTitle.value = area.name;
					const areaDescription = document.getElementById("area-data-description");
					areaDescription.value = area.description;

					await fill_subzones(area);

				});
            })
            .catch(error => {
                console.error('There was a problem fetching area metrics:', error.message);
            });

        })
        .catch(error => {
            console.error('There was a problem fetching processes:', error.message);
        });
}

function attachSelectedEvent() {
	const selectForms = document.querySelectorAll('.select-form');
	selectForms.forEach(form => {
		form.addEventListener('submit', function(event) {
			event.preventDefault();
			event.stopPropagation();
						
			const formData = new FormData(this);
			fetchAreaAPI("/set_process", {
				method: 'POST',
				body: formData
			})
			.catch(error => {
				console.error('There was a problem with the fetch operation:', error);
			});
		});
	});
}

function tradesAddProcess(area) {
    const container = document.getElementById(area + 'Processes');
    const newProcessDiv = document.createElement('div');
    newProcessDiv.className = 'form-group';
    newProcessDiv.innerHTML = `
        <label>Process ID:</label>
        <input type="number" class="form-control mb-2" placeholder="Process ID" name="${area}ProcessId[]">
        <label>Amount:</label>
        <input type="number" class="form-control mb-2" placeholder="Amount" name="${area}Amount[]">
    `;
    container.appendChild(newProcessDiv);
}

function submitTrade() {
    const homeProcessIds = document.querySelectorAll('input[name="homeProcessId[]"]');
    const homeAmounts = document.querySelectorAll('input[name="homeAmount[]"]');
	const remote_host_uri = document.getElementById('trade-initiate-foreign-area-uri').value;
	const remote_area_id = parseInt(document.getElementById('trade-initiate-foreign-area-id').value);
	const tradeData = {
        home_processes: [],
		remote_host_uri: remote_host_uri,
		remote_area_id: remote_area_id
    };

    homeProcessIds.forEach((input, index) => {
        tradeData.home_processes.push({
            id: parseInt(input.value),
            amount: parseInt(homeAmounts[index].value)
        });
    });

    fetchAreaAPI('/trade', {
        method: 'POST',
        body: JSON.stringify(tradeData)
    })
    .then(data => {
		if ( ! data.message ) {
			alert(data.error);
		}
		fetchTrades();
    })
    .catch(error => console.error('Error submitting trade:', error));
}
function fetchTrades() {
    fetchAreaAPI('/trades')
    .then(trades => {
        const tradesList = document.getElementById('trades-list');
        tradesList.innerHTML = '';
        trades.forEach(trade => {
            const listItem = document.createElement('div');
			const remote_dashboard_url = area_dashboard_url({uri: trade.remote_host_uri, id: trade.remote_area_id});
            listItem.className = 'list-group-item';
			listItem.innerHTML = `
				<div class="mb-3 card">
					<div class="card-body">
						<h5 class="card-title">Trade with <a href="${remote_dashboard_url}" target="_blank">${remote_dashboard_url}</a></h5>
						<div class="row">
							<div class="col-md-6">
								<h6>Home Area Processes</h6>
								<div class="form-check form-switch">
									<input class="form-check-input" type="checkbox" id="trade-status-${trade.id}" ${trade.home_confirm ? 'checked' : ''}>
									<label class="form-check-label" for="trade-status-${trade.id}">${trade.home_confirm ? 'Validated' : 'Pending'}</label>
								</div>
								<div id="trade-${trade.id}-home-processes" class="mb-2"></div>
								<button class="btn btn-outline-secondary btn-sm" onclick="tradeHomeAddProcess(${trade.id})" ${trade.home_confirm ? 'hidden' : ''} >Add Process</button>
							</div>
							<div class="col-md-6">
								<h6>Foreign Area Processes</h6>
								<p class="badge ${trade.remote_confirm ? 'bg-success' : 'bg-warning'}">${trade.remote_confirm ? 'Validated' : 'Pending'}</p>
								<div id="trade-${trade.id}-foreign-processes" class="mb-2"></div>
							</div>
						</div>
						<div class="d-flex justify-content-end mt-3">
							<button class="btn btn-primary me-2" onclick="updateTrade(${trade.id});dashboardRefresh()">Update</button>
							<button class="btn btn-danger" onclick="deleteTrade(${trade.id});dashboardRefresh()">Delete</button>
						</div>
					</div>
				</div>
			`;
	
            tradesList.appendChild(listItem);
			renderTrade(trade);
        });
    })
    .catch(error => console.error('Error fetching trades:', error));
}
function renderTrade(trade) {
	renderTradeHomeProcesses(trade);
	renderTradeForeignProcesses(trade);
}
function renderTradeForeignProcesses(trade) {
	const container = document.getElementById(`trade-${trade.id}-foreign-processes`);
    container.innerHTML = trade.remote_processes.map(p => generateForeignProcessInput(trade.id,p.id,p.amount)).join('');
}
function generateForeignProcessInput(tradeId,process_id='',process_amount=1) {
	const uniqueId = `trade-${tradeId}-foreign-${Math.random()}${Math.random()}${Math.random()}${Math.random()}`;

	return `
		<div class="input-group mb-2 trade-${tradeId}-foreign-process" id="${uniqueId}">
			<p>Process ID: ${process_id}</p>
			<p>amount: ${process_amount}</p>
		</div>
    `
}
function renderTradeHomeProcesses(trade) {
    const container = document.getElementById(`trade-${trade.id}-home-processes`);
    container.innerHTML = trade.home_processes.map(p => generateHomeProcessInput(trade.id,p.id,p.amount,trade.home_confirm)).join('');
}
function tradeHomeAddProcess(tradeId) {
    const homeTradesContainer = document.getElementById(`trade-${tradeId}-home-processes`);
    homeTradesContainer.insertAdjacentHTML('beforeend', generateHomeProcessInput(tradeId));
}
function generateHomeProcessInput(tradeId,process_id='',process_amount=1,home_confirm=false) {
	const uniqueId = `trade-${tradeId}-home-${Math.random()}${Math.random()}${Math.random()}${Math.random()}`;
	return `
		<div class="input-group mb-2 trade-${tradeId}-home-process" id="${uniqueId}">
			<input type="number" class="form-control" id="process-id" placeholder="Process ID" value="${process_id}" ${home_confirm ? 'disabled' : ''} >
			<input type="number" class="form-control" id="process-amount" placeholder="Amount" value="${process_amount}" ${home_confirm ? 'disabled' : ''} >
			<div class="input-group-append" ${home_confirm ? 'hidden' : ''} >
				<button class="btn btn-danger" onclick="document.getElementById('${uniqueId}').remove();updateTrade(${tradeId})">Delete</button>
			</div>
		</div>
	`
}
document.addEventListener('DOMContentLoaded', async function () {

	await Processes.fetchObjects();
	tradesSetup();
	setupExportDatabaseElement(document.getElementById('export-database-btn'));
	setupImportDatabaseElement(document.getElementById('import-database-file'));
	const areaResourcesPrefix = "area-resources";
	areaResourcesSetup(areaResourcesPrefix);
	addProcessSetup();

	document.getElementById("create-subzone").addEventListener("click", function(e) {
		fetchAreaAPI('/create_sub', {
            method: 'POST',
            body: JSON.stringify({})
        })
		.then(response => {
			dashboardRefresh();
		});
	});
	document.getElementById("area-data-set").addEventListener("click", function(e) {
		const areaTitle = document.getElementById("area-data-title");
		const areaDescription = document.getElementById("area-data-description");

		fetchAreaAPI('/area', {
            method: 'POST',
            body: JSON.stringify({name: areaTitle.value,description: areaDescription.value, id: AREA_DATA['area_id']})
        }).then(response => dashboardRefresh())
	});

	const searchInput = document.getElementById("process-list-search");
    searchInput.addEventListener("input", function () {
        const searchTerm = searchInput.value.toLowerCase();
		const accordionItems = document.querySelectorAll(".accordion-item");
        accordionItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(searchTerm) ? "block" : "none";
        });
    });

	updateRadarChart(0, 0, 0);

	document.getElementById("btn-adjust").addEventListener("click", governanceBuildScenario);

	// Fetch processes when the page loads
	dashboardRefresh();

	attachSelectedEvent();

	document.getElementById('add-process-btn').addEventListener('click', function(event) {
		event.preventDefault();

		let metrics = {};
		for(let sens of ['input','output']) {
			metrics[sens] = {};
			for(let metric of Processes.metricsGetIdsList()) {
				metrics[sens][metric] = parseFloat(document.getElementById(`add-process-metric-${sens}-${metric}`).value || 0);
			}
		}
		const processForm = document.getElementById('add-process-form');
		const process = {
			title: document.getElementById('add-process-title').value || '',
			amount: parseInt(document.getElementById('add-process-amount').value) || 0,  
			tags: document.getElementById('add-process-tags').value
					.split(',')
					.map(item => item.trim())
					.filter(item => item !== '') || [], 
			metrics: metrics,
			composition: []
		};
		
		processForm.querySelectorAll('.composition-process-group').forEach(group => {
			const process_id = group.querySelector('input[name="composition-process-id"]').value;
			const amount = group.querySelector('input[name="composition-process-amount"]').value;
			if ( process_id != null && process_id != null ) {
				process.composition.push({ 
					id: parseInt(process_id), 
					amount: parseInt(amount)
				});
			}
		});
		
		Processes.set(process)
			.then(() => {
				dashboardRefresh();
			})
			.catch(error => {
				console.error('There was a problem with the process submission:', error.message);
			});
	});	
		
	document.getElementById('export-btn').addEventListener('click', function() {
		fetchAreaAPI('/processes')
		.then(data => {
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'processes.json';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		})
	});

	document.getElementById('import-file').addEventListener('change', function(event) {
		const file = event.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = function(event) {
				Processes.set(JSON.parse(event.target.result))
				.then(() => {
					dashboardRefresh();
				})
				.catch(error => {
					console.error('There was a problem with the process submission:', error.message);
				});
			};
			reader.readAsText(file);
		}
	});

});