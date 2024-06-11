// dashboard.js
function getCompositionData() {
	const compositionContainer = document.getElementById('add-process-composition-container');
	const compositionDivs = compositionContainer.querySelectorAll('div');
	const compositionArray = Array.from(compositionDivs).map(div => {
		const processId = div.querySelector('input[name="composition-process-id"]').value;
		const processAmount = div.querySelector('input[name="composition-process-amount"]').value;
		return { id: parseInt(processId, 1), amount: parseInt(processAmount, 1) };
	});
	return compositionArray;
}

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
		const composition = getCompositionData();
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
		const distanceEconomic = Math.abs(process.amount * processRetrieveMetric(allProcesses, process, "economic") - goalEconomic);
		const distanceEnvEmissions = Math.abs(process.amount * processRetrieveMetric(allProcesses, process, "envEmissions") - goalEnvEmissions);
		const distanceSocial = Math.abs(process.amount * processRetrieveMetric(allProcesses, process, "social") - goalSocial);
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
			totalEconomic += processRetrieveMetric(allProcesses, closestProcess, "economic") * closestProcess.amount;
			selectedGovEnvEmissions += processRetrieveMetric(allProcesses, closestProcess, "envEmissions") * closestProcess.amount;
			totalSocial += processRetrieveMetric(allProcesses, closestProcess, "social") * closestProcess.amount;
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

function createCompositionDiv(process, composition) {
	const compositionDiv = document.createElement('div');
	compositionDiv.classList.add('composition-process-group', 'mb-2');

	const processIdLabel = document.createElement('label');
	processIdLabel.textContent = 'Process ID:';
	compositionDiv.appendChild(processIdLabel);

	const processIdInput = document.createElement('input');
	processIdInput.setAttribute('type', 'number');
	processIdInput.setAttribute('name', 'composition-process-id');
	processIdInput.setAttribute('value', composition.id);
	processIdInput.classList.add('form-control', 'mr-2');
	compositionDiv.appendChild(processIdInput);

	const processAmountLabel = document.createElement('label');
	processAmountLabel.textContent = ' Amount:';
	compositionDiv.appendChild(processAmountLabel);

	const processAmountInput = document.createElement('input');
	processAmountInput.setAttribute('type', 'number');
	processAmountInput.setAttribute('name', 'composition-process-amount');
	processAmountInput.setAttribute('value', composition.amount);
	processAmountInput.classList.add('form-control', 'mr-2');
	compositionDiv.appendChild(processAmountInput);

	const updateBtn = document.createElement('button');
	updateBtn.textContent = 'Update';
	updateBtn.classList.add('btn', 'btn-primary', 'mr-2');
	updateBtn.addEventListener('click', () => {
		const updatedComposition = {
			id: parseInt(processIdInput.value, 1),
			amount: parseInt(processAmountInput.value, 1)
		};
		updateComposition(process.id, updatedComposition);
	});
	compositionDiv.appendChild(updateBtn);

	const deleteBtn = document.createElement('button');
	deleteBtn.textContent = 'Delete';
	deleteBtn.classList.add('btn', 'btn-danger');
	deleteBtn.addEventListener('click', () => {
		deleteComposition(process.id, composition.id);
	});
	compositionDiv.appendChild(deleteBtn);

	return compositionDiv;
}

function updateComposition(processId, composition) {
	fetch(`/update_composition/${processId}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(composition)
	})
	.then(response => response.json())
	.then(data => {
		if (data.success) {
			fetchProcesses();
		} else {
			console.error('Error updating composition:', data.error);
		}
	})
	.catch(error => console.error('Error updating composition:', error));
}

function deleteComposition(processId, compositionId) {
	fetch(`/delete_composition/${processId}/${compositionId}`, {
		method: 'POST'
	})
	.then(response => response.json())
	.then(data => {
		if (data.success) {
			fetchProcesses();
		} else {
			console.error('Error deleting composition:', data.error);
		}
	})
	.catch(error => console.error('Error deleting composition:', error));
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
						for(let metric of processMetricsIdsGetList()) {
							selectedProcessMetrics[sens][metric] = 0;
						}
					}

					allProcesses.forEach(process => {
						function findProcessById(processes, id) {
							return processes ? processes.find(process => process.id === id) : null;
						}
						const usage = findProcessById(country.processes, process.id);
						if ( usage ) {
							const amount = usage.usage_count;
							for(let sens of ['input','output']) {
								selectedProcessMetrics[sens] = {};
								for(let metric of processMetricsIdsGetList()) {
									if ( ! selectedProcessMetrics[sens][metric] ) {
										selectedProcessMetrics[sens][metric] = 0;
									}
									selectedProcessMetrics[sens][metric] += processRetrieveMetric(allProcesses, process, sens, metric) * amount || 0;
								}
							}
						}
						processList.appendChild(createProcessElement(allProcesses,process,usage));
					});

					for(let sens of ['input','output']) {
						const container = document.getElementById(`country-resource-total-${sens}`);
						for(let metric of processMetricsGetList()) {
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
					for(let metric of processMetricsGetList()) {
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

function createProcessElement(allProcesses,process,usage) {
	const process_selected = usage != undefined && 0 < usage.usage_count;
	const process_amount = usage == undefined ? 0 : usage.usage_count;
	const li = document.createElement('li');
	li.classList.add("list-group-item");
	li.setAttribute("process-id", process.id);
	li.setAttribute("metrics", JSON.stringify(process.metrics));
	li.setAttribute("title", process.title);
	li.setAttribute("process-amount", process.amount);
	const compoStr = JSON.stringify(process.composition);
	li.setAttribute("process-composition", compoStr);

	li.innerHTML = `
		<div class="card mb-3">
			<div class="card-header d-flex justify-content-between align-items-center">
				<form action="/select_process" method="POST">
					<input type="checkbox" ${process_selected ? "checked" : ""}>
					<input type="hidden" name="id" value="${process.id}">
					<input type="hidden" name="selected" value="${process_selected ? 1 : 0}">
				</form>
				<div>
					<strong>${process.title}</strong> (ID: ${process.id})
				</div>
				<button class="btn btn-danger btn-sm" onclick="deleteProcess(${process.id})">Delete</button>
			</div>
			<div class="card-body">
				<div class="row">
					<div class="col-md-4">
						<h6>Amount</h6>
						<ul class="list-unstyled">
							<li><input type="number" class="form-control mt-2" id="view-process-amount-${process.id}" value="${process_amount}" /></li>
						</ul>
					</div>
					<div class="col-md-4">
						<h6>Process input</h6>
						<ul class="list-unstyled" id="process-view-metrics-input"></ul>
					</div>
					<div class="col-md-4">
						<h6>Process output</h6>
						<ul class="list-unstyled" id="process-view-metrics-output"></ul>
					</div>
				</div>
				<hr>
				<div class="row">
					<h6 class="mt-3">Cumulative Metrics</h6>
				</div>
				<div class="row">
					<div class="col-md-4">
						For ${processNSubProcess(allProcesses,process)} subprocess
					</div>
					<div class="col-md-4">
						<h6>Process input</h6>
						<ul class="list-unstyled" id="process-view-cumulative-metrics-input"></ul>
					</div>
					<div class="col-md-4">
						<h6>Process output</h6>
						<ul class="list-unstyled" id="process-view-cumulative-metrics-output"></ul>
					</div>
				</div>
				<hr>
				<div class="row">
					<div class="col">
						<h6>Composition</h6>
						<div id="composition-container-${process.id}">
						</div>
					</div>
				</div>
				<hr>
				<div class="row">
					<div class="col-md-4">
						<button class="btn btn-outline-success" onclick="likeProcess(${process.id})">Like</button>
						<button class="btn btn-outline-danger" onclick="dislikeProcess(${process.id})">Dislike</button>
						<p>Score: ${process.like_count || 0}</p>
					</div>
					<div class="col-md-8">
						<h6>Comments</h6>
						<ul class="list-unstyled" id="comments-${process.id}">
							${process.comments.map(comment => `<li><strong>${comment.user}</strong> (${new Date(comment.date).toLocaleString()}): ${comment.text}</li>`).join('')}
						</ul>
						<textarea class="form-control" id="comment-text-${process.id}" rows="2"></textarea>
						<button class="btn btn-primary mt-2" onclick="addComment(${process.id}, document.getElementById('comment-text-${process.id}').value)">Add Comment</button>
					</div>
				</div>
			</div>
		</div>
	`;

	for(let sens of ['input','output']) {
		const metricsElement = li.querySelector(`#process-view-metrics-${sens}`);
		for(let metric of processMetricsIdsGetList()) {
			const metricElement = document.createElement('li');
			metricElement.textContent = `${metric}: ${process.metrics[sens][metric]}`;
			metricsElement.appendChild(metricElement);
		}
		const cumulativeMetricsElement = li.querySelector(`#process-view-cumulative-metrics-${sens}`);
		for(let metric of processMetricsIdsGetList()) {
			const cumulativeMetricElement = document.createElement('li');
			cumulativeMetricElement.textContent = `${metric}: ${processRetrieveMetric(allProcesses, process, sens, metric)}`;
			cumulativeMetricsElement.appendChild(cumulativeMetricElement);
		}
	}
	const compositionContainer = li.querySelector(`#composition-container-${process.id}`);
	process.composition.forEach(composition => {
		const compositionDiv = createCompositionDiv(process, composition);
		compositionContainer.appendChild(compositionDiv);
	});

	const amountInput = li.querySelector(`#view-process-amount-${process.id}`);
	amountInput.addEventListener('change', () => {
		const newAmount = amountInput.value;
		fetch(`/update_process_usage/${process.id}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				usage_count: newAmount
			})
		})
		.then(response => response.json())
		.then(updatedProcess => {
			console.log(`Process ${updatedProcess.id} amount updated to ${newAmount}`);
			fetchProcesses();
		})
		.catch(error => console.error('Error updating process amount:', error));
	});

	const form = li.querySelector('form');
	const checkbox = form.querySelector('input[type="checkbox"]');
	const checkboxS = form.querySelector('input[type="hidden"][name="selected"]');

	checkbox.addEventListener('click', function (e) {
		checkboxS.value = checkbox.checked ? 1 : 0;
		form.submit();
	});
	return li;
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

function tradesAttach() {
	document.getElementById('show-trade-modal').addEventListener('click', function() {
		$('#tradeModal').modal('show');
	});
	fetchTrades();
}

document.addEventListener('DOMContentLoaded', function () {

	countryResourcesFillDefault();
	tradesAttach();
	setupExportDatabaseElement(document.getElementById('export-database-btn'));
	setupImportDatabaseElement(document.getElementById('import-database-file'));
	addProcessMetricsForm('input');
	addProcessMetricsForm('output');
	const countryResourcesPrefix = "country-resources";
	countryResourcesSetElements(countryResourcesPrefix);

	const compositionContainer = document.getElementById('add-process-composition-container');
	const addCompositionBtn = document.getElementById('add-process-add-composition');

	updateRadarChart(0, 0, 0);

	fetch('/get_country')
		.then(response => response.json())
		.then(country => {
			const data = country.resources;
			for(let metric of processMetricsIdsGetList()) {
				document.getElementById(`${countryResourcesPrefix}-${metric}-amount`).value = data[metric] ? data[metric].amount || 0 : 0;
				document.getElementById(`${countryResourcesPrefix}-${metric}-renew-rate`).value = data[metric] ? data[metric].renew_rate || 0 : 0;
			}
		});

	document.getElementById('btn-set-resources').addEventListener('click', () => {
		const resources = {};
		for(let metric of processMetricsIdsGetList()) {
			resources[metric] = {
				amount: document.getElementById(`${countryResourcesPrefix}-${metric}-amount`).value || 0,
				renew_rate: document.getElementById(`${countryResourcesPrefix}-${metric}-renew-rate`).value || 0
			};
		}
		fetch('/set_country', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({resources: resources})
		}).then(response => response.json())
			.then(data => {
				if (data.success) {
					fetchProcesses();
				}
			});
	});

	addCompositionBtn.addEventListener('click', () => {
		const compositionDiv = document.createElement('div');
		compositionDiv.setAttribute('class', 'composition-process-group');

		const processIdLabel = document.createElement('label');
		processIdLabel.textContent = 'Process ID:';
		compositionDiv.appendChild(processIdLabel);

		const processIdInput = document.createElement('input');
		processIdInput.setAttribute('type', 'number');
		processIdInput.setAttribute('name', 'composition-process-id');
		compositionDiv.appendChild(processIdInput);

		const processAmountLabel = document.createElement('label');
		processAmountLabel.textContent = ' Amount:';
		compositionDiv.appendChild(processAmountLabel);

		const processAmountInput = document.createElement('input');
		processAmountInput.setAttribute('type', 'number');
		processAmountInput.setAttribute('name', 'composition-process-amount');
		compositionDiv.appendChild(processAmountInput);

		compositionContainer.appendChild(compositionDiv);
	});

	document.getElementById("btn-adjust").addEventListener("click", selectProcesses);

	// Fetch processes when the page loads
	fetchProcesses();

	attachSelectedEvent();

	document.getElementById('add-process-btn').addEventListener('click', function(event) {
		event.preventDefault();

		let metrics = {};
		for(let sens of ['input','output']) {
			metrics[sens] = {};
			for(let metric of processMetricsIdsGetList()) {
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
		
		setProcess(process)
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
				setProcess(JSON.parse(event.target.result))
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