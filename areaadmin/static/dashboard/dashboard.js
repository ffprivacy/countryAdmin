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

function setScenario(scenario) {
	let economic, social, envEmissions;
	if (scenario === 'capitalism') {
		economic = 1000;
		social = 0;
		envEmissions = 1000;
	} else if (scenario === 'hell') {
		economic = 1000;
		social = 0;
		envEmissions = 0;
	} else if (scenario === 'diamond') {
		economic = 1000;
		social = 1000;
		envEmissions = 0;
	}

	document.getElementById('economic-goals').value = economic;
	document.getElementById('social-goals').value = social;
	document.getElementById('governance-goals-env-emissions').value = envEmissions;
}

function selectProcesses() {
	const processList = document.getElementById('process-list');

	const economicGoal = parseInt(document.getElementById('economic-goals').value, 10);
	const govGoalEnvEmissions = parseInt(document.getElementById('governance-goals-env-emissions').value, 10);
	const socialGoal = parseInt(document.getElementById('social-goals').value, 10);

	const allProcesses = [...processList.getElementsByTagName('li')].map(li => {
		const form = li.querySelector('form');
		const checkbox = form.querySelector('input[name="selected"]');
		const id = parseInt(form.querySelector('input[name="id"]').value);
		const process_id = parseInt(li.getAttribute("process-id"));
		const metrics = JSON.parse(li.getAttribute("metrics"));
		const amount = parseInt(li.getAttribute("process-amount"));
		const composition = addProcessGetCompositionData();
		return { id, process_id, metrics, selected: checkbox.checked, amount, composition, form };
	});

	// Unselect all processes
	allProcesses.forEach(process => {
		process.selected = false;
		process.form.querySelector('input[name="selected"]').checked = false;
	});

	// Group processes by process_id
	const processMap = new Map();
	allProcesses.forEach(process => {
		if (!processMap.has(process.process_id)) {
			processMap.set(process.process_id, []);
		}
		processMap.get(process.process_id).push(process);
	});

	/**
	 *  Procédure pour choisir les process à utiliser parmis les autres.
	 * 
	 *  Remplir les objectifs en emissions en faisant en sorte que la charge de travail (on parle en h) soit répartie.
	 *  Tout en tenant compte des différences de capacité des travailleurs (formation, compétences, nature).
	 *  Les objectifs en emissions peuvent être une contrainte si elles amènent à plus de travail de la part des travailleurs et c'est ce plus qu'il faut répartir,
	 *   pour rester socialement juste.
	 *  Mais dans certains cas la modification est transparente (thermique -> electrique) (decarbonation de l'electricité) (des ampoules qui consomment moins)
	 *  Résoudre toutes les modifications transparentes pour l'utilisateur et si le producteur n'obtiens pas trop de contraintes (reste viable economiquement et socialement).
	 *  Un exemple typique de modidification non transparente et couteuse aux utilisateurs, le composte (un vrai), c'est à dire une modification du process "Jeter un déchet vert".
	 *   un autre exemple de process "Se débarrasser d'un inutile". Il y a le tri des déchets, une modification du process coûteuse aux utilisateurs. Il y a jeter dans la nature.
	 *    pour ce dernier une amélioration du process sans impacter les utilisateurs, trier mécaniquement grace à l'ia les déchets peut importe ce qui arrive.
	 * 
	 *  Remplir les objectifs en économie n'a pas forcément besoin d'être équilibré (service public en négatif, investissement en positif)
	 *  On peut adopter contraintes min sur certains points critiques de l'économie, mais le social baisse.
	 *  Pour que le social tienne au nom de la cohésion sociale, il n'en faut pas beaucoup, sinon la metrique sociale baisse de trop et il faut
	 *  redistribution en fonction de la charge de travail.
	 *  Du fait du jeu, il y a de la rareté des biens (ne reflète pas la quantité de travail donné), c'est un biais humain.
	 *  
	 */
	let totalEconomic = 0;
	let selectedGovEnvEmissions = 0;
	let totalSocial = 0;

	// Calculate the distance between each process and the goals
	const calculateDistance = (allProcesses, process, goalEconomic, goalEnvEmissions, goalSocial) => {
		const distanceEconomic = Math.abs(process.amount * Processes.retrieveMetric(allProcesses, process, "economic") - goalEconomic);
		const distanceEnvEmissions = Math.abs(process.amount * Processes.retrieveMetric(allProcesses, process, "envEmissions") - goalEnvEmissions);
		const distanceSocial = Math.abs(process.amount * Processes.retrieveMetric(allProcesses, process, "social") - goalSocial);
		return distanceEconomic + distanceEnvEmissions + distanceSocial;
	};

	// Select processes based on goals
	/**
	 * Les processus qui peuvent être permutables devraint être recherchés automatiquement.
	 * On pourrait dans un premier temps (comme c'était avant le cas utiliser un process_id ou group de processus interchangeable) (qui ont strictement les mêmes but du point de vue utilisateur)
	 * Ou alors procéder en produits/consommable: des processus au vu des contraintes de la gouvernance produisent les même choses et
	 * qui consomment à peu près les mêmes resources voir moins dans l'idéal peuvent être permutés.
	 * Par exemple sur la voiture électrique peut être qu'il y a un peu plus potentiellement de travail à la production,
	 * mais moins de travail dans la recharge (transport des hydrocarb, personnel, etc).
	 */
	const selectedProcessIds = new Set();
	processMap.forEach(processes => {
		let minDistance = Infinity;
		let closestProcess = null;
		for (const process of processes) {
			if (!selectedProcessIds.has(process.process_id)) {
				const distance = calculateDistance(allProcesses, process, economicGoal - totalEconomic, govGoalEnvEmissions - selectedGovEnvEmissions, socialGoal - totalSocial);
				if (distance < minDistance) {
					minDistance = distance;
					closestProcess = process;
				}
			}
		}
		if (closestProcess) {
			closestProcess.selected = true;
			selectedProcessIds.add(closestProcess.process_id);
			totalEconomic += Processes.retrieveMetric(allProcesses, closestProcess, "economic") * closestProcess.amount;
			selectedGovEnvEmissions += Processes.retrieveMetric(allProcesses, closestProcess, "envEmissions") * closestProcess.amount;
			totalSocial += Processes.retrieveMetric(allProcesses, closestProcess, "social") * closestProcess.amount;
		}
	});

	const formData = new FormData();
	allProcesses.forEach(process => {
		formData.append('id[]', process.id);
		formData.append('selected[]', process.selected);
	});

	fetch(`/api/area/${dashboard_data['area_id']}/select_process`, {
		method: 'POST',
		body: formData
	})
		.then(() => dashboardRefresh())
		.catch(function (e) {
			console.warn(e);
		});
}
function JSON_parse(response) {
	return response.text().then(text => {
        return JSON.parse(text, (key, value) => {
            if (value === "Infinity") return Infinity;
            if (value === "-Infinity") return -Infinity;
            if (value === "NaN") return NaN;
            return value;
        });
    });
}
function dashboardRefresh() {
    return fetch('/api/processes')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return JSON_parse(response);
        })
        .then(async function (data) {
            const processList = document.getElementById('process-list');
            const allProcesses = data;
            processList.innerHTML = '';

            fetch(`/api/area/${dashboard_data['area_id']}/metrics`)
            .then(response => JSON_parse(response))
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

				fetch(`/api/area/${dashboard_data['area_id']}`)
				.then(response => JSON_parse(response))
				.then(async function(area) {
					const pageTitle = document.getElementById("dashboard-title");
					pageTitle.innerText = ` - ${area.name}`;
					const subzones = document.getElementById("area-subareas");
					subzones.innerHTML = '';
					for(let composition of area.compositions) {
						const id = composition['id'];
						let child = await fetch(`/api/area/${id}`).then(response => JSON_parse(response));
						let childElement = document.createElement('div');
						childElement.className = "card card-body";
						let childUri = dashboard_area_generate_uri_from_database("" + id);
						childElement.innerHTML = `
							<div><a href="${childUri}" target="_blank">${child.name}</a></div>
							<div>${child.description}</div>
						`;
						subzones.appendChild(childElement);
					}
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
			fetch(this.action, {
				method: 'POST',
				body: formData
			})
			.then(response => {
				if (response.ok) {
					  dashboardRefresh();
				  return response.text();
				}
				throw new Error('Network response was not ok.');
			})
			.then(data => {
				console.log(data);
				// Optionally handle response data
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
	const foreignAreaUri = document.getElementById('trade-initiate-foreign-area-uri').value;
    const tradeData = {
        home_processes: [],
		to_area_uri: foreignAreaUri
    };

    homeProcessIds.forEach((input, index) => {
        tradeData.home_processes.push({
            id: parseInt(input.value),
            amount: parseInt(homeAmounts[index].value)
        });
    });

    fetch(`/api/area/${dashboard_data['area_id']}/trade`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(tradeData)
    })
    .then(response => JSON_parse(response))
    .then(data => {
		if ( ! data.message ) {
			alert(data.error);
		}
		fetchTrades();
    })
    .catch(error => console.error('Error submitting trade:', error));
}
function fetchTrades() {
    fetch(`/api/area/${dashboard_data['area_id']}/trades`)
    .then(response => JSON_parse(response))
    .then(trades => {
        const tradesList = document.getElementById('trades-list');
        tradesList.innerHTML = '';
        trades.forEach(trade => {
            const listItem = document.createElement('div');
			const to_area_uri = dashboard_area_generate_uri_from_database(trade.to_area_uri);
            listItem.className = 'list-group-item';
			listItem.innerHTML = `
				<div class="mb-3 card">
					<div class="card-body">
						<h5 class="card-title">Trade with <a href="${to_area_uri}" target="_blank">${to_area_uri}</a></h5>
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
								<p class="badge ${trade.foreign_confirm ? 'bg-success' : 'bg-warning'}">${trade.foreign_confirm ? 'Validated' : 'Pending'}</p>
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
    container.innerHTML = trade.foreign_processes.map(p => generateForeignProcessInput(trade.id,p.id,p.amount)).join('');
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
document.addEventListener('DOMContentLoaded', function () {

	tradesSetup();
	setupExportDatabaseElement(document.getElementById('export-database-btn'));
	setupImportDatabaseElement(document.getElementById('import-database-file'));
	const areaResourcesPrefix = "area-resources";
	areaResourcesSetup(areaResourcesPrefix);
	addProcessSetup();

	document.getElementById("create-subzone").addEventListener("click", function(e) {
		fetch(`/api/area/${dashboard_data['area_id']}/create_sub`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        })
		.then(response => {
			dashboardRefresh();
		});
	});

	updateRadarChart(0, 0, 0);

	document.getElementById("btn-adjust").addEventListener("click", selectProcesses);

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
		fetch('/api/processes')
		.then(response => {
		if (!response.ok) {
			throw new Error('Network response was not ok');
		}
		return JSON_parse(response);
		})
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