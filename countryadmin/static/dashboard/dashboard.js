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
		const processId = parseInt(li.getAttribute("process-id"));
		const metrics = JSON.parse(li.getAttribute("metrics"));
		const amount = parseInt(li.getAttribute("process-amount"));
		const composition = addProcessGetCompositionData();
		return { id, processId, metrics, selected: checkbox.checked, amount, composition, form };
	});

	// Unselect all processes
	allProcesses.forEach(process => {
		process.selected = false;
		process.form.querySelector('input[name="selected"]').checked = false;
	});

	// Group processes by process_id
	const processMap = new Map();
	allProcesses.forEach(process => {
		if (!processMap.has(process.processId)) {
			processMap.set(process.processId, []);
		}
		processMap.get(process.processId).push(process);
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
	 * On pourrait dans un premier temps (comme c'était avant le cas utiliser un processId ou group de processus interchangeable) (qui ont strictement les mêmes but du point de vue utilisateur)
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
			if (!selectedProcessIds.has(process.processId)) {
				const distance = calculateDistance(allProcesses, process, economicGoal - totalEconomic, govGoalEnvEmissions - selectedGovEnvEmissions, socialGoal - totalSocial);
				if (distance < minDistance) {
					minDistance = distance;
					closestProcess = process;
				}
			}
		}
		if (closestProcess) {
			closestProcess.selected = true;
			selectedProcessIds.add(closestProcess.processId);
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

	fetch('/select_process', {
		method: 'POST',
		body: formData
	})
		.then(() => fetchProcesses())
		.catch(function (e) {
			console.warn(e);
		});
}
function fetchProcesses() {
	return fetch('/get_processes')
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

			fetch('/get_country')
				.then(response => response.json())
				.then(country => {
					const countryResources = country.resources;
					let selectedProcessMetrics = {};
					for(let sens of ['input','output']) {
						selectedProcessMetrics[sens] = {};
						for(let metric of Processes.metricsGetIdsList()) {
							selectedProcessMetrics[sens][metric] = 0;
						}
					}

					allProcesses.forEach(process => {
						const usage = Processes.getById(country.processes, process.id);
						if ( usage ) {
							const amount = usage.usage_count;
							for(let sens of ['input','output']) {
								selectedProcessMetrics[sens] = {};
								for(let metric of Processes.metricsGetIdsList()) {
									if ( ! selectedProcessMetrics[sens][metric] ) {
										selectedProcessMetrics[sens][metric] = 0;
									}
									selectedProcessMetrics[sens][metric] += Processes.retrieveMetric(allProcesses, process, sens, metric) * amount || 0;
								}
							}
						}
						processList.appendChild(processCreateElement(allProcesses,process,usage));
					});

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
							element.innerHTML = `<p>${metric.label}: <span>${selectedProcessMetrics[sens][metric.id]}</span> ${metric.unit}</p>`;
						}
					}
					
					const getTimeToDepletion = (resourceAmount, renewRate, usage) => {
						let resourceRenewAmount = resourceAmount * renewRate;
						if (usage <= resourceRenewAmount) {
							return "∞";
						} else {
							if ( 0 < usage ) {
								return (((resourceAmount + resourceRenewAmount) / usage)).toFixed(2);
							} else {
								return Math.abs(resourceAmount / resourceRenewAmount).toFixed(2);
							}
						}
					};

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
														selectedProcessMetrics['output'][metric.id] - selectedProcessMetrics['input'][metric.id])}
												</span>
											</p>`;
					}
					updateRadarChart(selectedProcessMetrics.economic, selectedProcessMetrics.co2eqEmission, selectedProcessMetrics.social);
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
					  fetchProcesses();
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

function initiateTrade() {
    const tradeData = {
        to_country_uri: document.getElementById('to-country-uri').value,
        from_process_id: parseInt(document.getElementById('from-process-id').value),
        to_process_id: parseInt(document.getElementById('to-process-id').value),
        from_amount: parseInt(document.getElementById('from-amount').value),
        to_amount: parseInt(document.getElementById('to-amount').value)
    };
    fetch('/initiate_trade', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(tradeData)
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        if (data.success) {
            $('#tradeModal').modal('hide');
            fetchTrades();
        }
    })
    .catch(error => console.error('Error initiating trade:', error));
}

function fetchTrades() {
    fetch('/get_trades')
    .then(response => response.json())
    .then(trades => {
        const tradesList = document.getElementById('trades-list');
        tradesList.innerHTML = '';
        trades.forEach(trade => {
            const listItem = document.createElement('div');
            listItem.className = 'list-group-item';
            listItem.textContent = `Trade with ${trade.to_country_uri}: ${trade.from_process_id} (amount: ${trade.from_amount}) for ${trade.to_process_id} (amount: ${trade.to_amount}) - Status: ${trade.status}`;
            tradesList.appendChild(listItem);
        });
    })
    .catch(error => console.error('Error fetching trades:', error));
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
	fetchProcesses();

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
			process.composition.push({ 
				id: parseInt(group.querySelector('input[name="composition-process-id"]').value), 
				amount: parseInt(group.querySelector('input[name="composition-process-amount"]').value)
			});
		});
		
		Processes.set(process)
			.then(() => {
				fetchProcesses();
			})
			.catch(error => {
				console.error('There was a problem with the process submission:', error.message);
			});
	});	
		
	document.getElementById('export-btn').addEventListener('click', function() {
		fetch('/get_processes')
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
					fetchProcesses();
				})
				.catch(error => {
					console.error('There was a problem with the process submission:', error.message);
				});
			};
			reader.readAsText(file);
		}
	});

});