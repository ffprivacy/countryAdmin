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

	fetch('/api/select_process', {
		method: 'POST',
		body: formData
	})
		.then(() => dashboardRefresh())
		.catch(function (e) {
			console.warn(e);
		});
}
function dashboardRefresh() {
	return fetch('/api/get_processes')
		.then(response => {
			if (!response.ok) {
				throw new Error('Network response was not ok');
			}
			return response.json();
		})
		.then(async function (data) {
			const processList = document.getElementById('process-list');
			const allProcesses = data;
			processList.innerHTML = '';

			fetch('/api/get_country')
				.then(response => response.json())
				.then(country => {
					fetch('/api/get_trades')
					.then(response => response.json())
					.then(async function (trades) {
						const countryResources = country.resources;
						let countryMetrics = {};
						for(let sens of ['input','output']) {
							countryMetrics[sens] = {};
							for(let metric of Processes.metricsGetIdsList()) {
								countryMetrics[sens][metric] = 0;
							}
						}
	
						allProcesses.forEach(process => {
							for(let sens of ['input','output']) {
								for(let metric of Processes.metricsGetIdsList()) {
									let metric_value = Processes.retrieveMetric(allProcesses, process, sens, metric) * process.amount || 0;
									countryMetrics[sens][metric] += metric_value;
								}
							}
							processList.appendChild(processCreateElement(allProcesses,process));
						});
	
						for(let trade of trades) {
							for (let process of trade.home_processes) {
								let processObj = Processes.getById(allProcesses,process.process_id);
								for(let metric of Processes.metricsGetIdsList()) {
									let metric_value = Processes.retrieveMetric(allProcesses, processObj, 'output', metric) * process.amount || 0;
									countryMetrics['output'][metric] -= metric_value;
								}
							}
							let allForeignProcesses = await fetch(`${trade.to_country_uri}/api/get_processes`)
																.then(response => response.json())
																.catch(error => {
																	console.error('There was a problem fetching foreign processes:', error.message);
																});
							for (let process of trade.foreign_processes) {
								let processObj = Processes.getById(allForeignProcesses,process.process_id);
								for(let metric of Processes.metricsGetIdsList()) {
									let metric_value = Processes.retrieveMetric(allForeignProcesses, processObj, 'output', metric) * process.amount || 0;
									countryMetrics['output'][metric] += metric_value;
								}
							}
						}
	
						for(let sens of ['input','output']) {
							const container = document.getElementById(`country-resource-total-${sens}`);
							for(let metric of Processes.metricsGetList()) {
								const id = `country-resource-total-${sens}-${metric.id}`;
								let element = document.getElementById(id);
								if ( !element ) {
									element = document.createElement('div');
									element.className = "col-6 col-md-6 card card-body";
									element.id = id;
									container.appendChild(element);
								}
								element.innerHTML = `<p>${metric.label}: <span>${countryMetrics[sens][metric.id]}</span> ${metric.unit}</p>`;
							}
						}
						
						const getTimeToDepletion = (resourceAmount, renewRate, usageBalance) => {
							let resourceRenewAmount = resourceAmount * renewRate;
							let netUsage = resourceRenewAmount + usageBalance;
						
							if (netUsage >= 0) { 
								return "∞";
							} else { 
								return (Math.abs(resourceAmount / netUsage)).toFixed(2);
							}
						}
	
						const container = document.getElementById("country-resource-depletion");
						for(let metric of Processes.metricsGetList()) {
							const id = `country-resources-depletion-time-${metric.id}-container`
							let element = document.getElementById(id);
							if (!element) {
								element = document.createElement('div');
								element.className = "col-6 col-md-6 card card-body";
								element.id = id;
								container.appendChild(element);
							}
							element.innerHTML = `<p>${metric.label}: 
													<span id="country-resources-depletion-time-${metric.id}">
														${getTimeToDepletion(
															countryResources[metric.id] ? countryResources[metric.id].amount || 0 : 0,
															countryResources[metric.id] ? countryResources[metric.id].renew_rate || 0 : 0,
															countryMetrics['output'][metric.id] - countryMetrics['input'][metric.id])}
													</span>
												</p>`;
						}
						updateRadarChart(countryMetrics['output'].economic, countryMetrics['input'].envEmissions-countryMetrics['output'].envEmissions, countryMetrics['output'].social);
					})
					.catch(error => {
						console.error('There was a problem fetching trades:', error.message);
					});
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

function tradesAddProcess(country) {
    const container = document.getElementById(country + 'Processes');
    const newProcessDiv = document.createElement('div');
    newProcessDiv.className = 'form-group';
    newProcessDiv.innerHTML = `
        <label>Process ID:</label>
        <input type="number" class="form-control mb-2" placeholder="Process ID" name="${country}ProcessId[]">
        <label>Amount:</label>
        <input type="number" class="form-control mb-2" placeholder="Amount" name="${country}Amount[]">
    `;
    container.appendChild(newProcessDiv);
}

function submitTrade() {
    const homeProcessIds = document.querySelectorAll('input[name="homeProcessId[]"]');
    const homeAmounts = document.querySelectorAll('input[name="homeAmount[]"]');
	const foreignCountryUri = document.getElementById('trade-initiate-foreign-country-uri').value;
    const tradeData = {
        home_processes: [],
		to_country_uri: foreignCountryUri
    };

    homeProcessIds.forEach((input, index) => {
        tradeData.home_processes.push({
            process_id: parseInt(input.value),
            amount: parseInt(homeAmounts[index].value)
        });
    });

    fetch('/api/trade/-1', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(tradeData)
    })
    .then(response => response.json())
    .then(data => {
		if ( ! data.message ) {
			alert(data.error);
		}
		fetchTrades();
    })
    .catch(error => console.error('Error submitting trade:', error));
}
function fetchTrades() {
    fetch('/api/get_trades')
    .then(response => response.json())
    .then(trades => {
        const tradesList = document.getElementById('trades-list');
        tradesList.innerHTML = '';
        trades.forEach(trade => {
            const listItem = document.createElement('div');
            listItem.className = 'list-group-item';
			listItem.innerHTML = `
				<div class="mb-3 card">
					<div class="card-body">
						<h5 class="card-title">Trade with <a href="${trade.to_country_uri}" target="_blank">${trade.to_country_uri}</a></h5>
						<div class="row">
							<div class="col-md-6">
								<h6>Home Country Processes</h6>
								<div class="form-check form-switch">
									<input class="form-check-input" type="checkbox" id="trade-status-${trade.id}" ${trade.home_confirm ? 'checked' : ''}>
									<label class="form-check-label" for="trade-status-${trade.id}">${trade.home_confirm ? 'Validated' : 'Pending'}</label>
								</div>
								<div id="trade-${trade.id}-home-processes" class="mb-2"></div>
								<button class="btn btn-outline-secondary btn-sm" onclick="tradeHomeAddProcess(${trade.id})" ${trade.home_confirm ? 'hidden' : ''} >Add Process</button>
							</div>
							<div class="col-md-6">
								<h6>Foreign Country Processes</h6>
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
    container.innerHTML = trade.foreign_processes.map(p => generateForeignProcessInput(trade.id,p.process_id,p.amount)).join('');
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
    container.innerHTML = trade.home_processes.map(p => generateHomeProcessInput(trade.id,p.process_id,p.amount,trade.home_confirm)).join('');
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
	const countryResourcesPrefix = "country-resources";
	countryResourcesSetup(countryResourcesPrefix);
	addProcessSetup();

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
		fetch('/api/get_processes')
		.then(response => {
		if (!response.ok) {
			throw new Error('Network response was not ok');
		}
		return response.json();
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