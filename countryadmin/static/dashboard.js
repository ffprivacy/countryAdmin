// dashboard.js
function getCompositionData() {
	const compositionContainer = document.getElementById('add-process-composition-container');
	const compositionDivs = compositionContainer.querySelectorAll('div');
	const compositionArray = Array.from(compositionDivs).map(div => {
		const processId = div.querySelector('input[name="composition-process-id"]').value;
		const processAmount = div.querySelector('input[name="composition-process-amount"]').value;
		return { id: parseInt(processId, 10), amount: parseInt(processAmount, 10) };
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
		const metrics = {
			economic: parseInt(li.getAttribute("economic")),
			envEmissions: parseInt(li.getAttribute("env-emissions")),
			social: parseInt(li.getAttribute("social")),
			human: parseFloat(li.getAttribute("human")),
			ground: parseFloat(li.getAttribute("ground")),
			ores: parseFloat(li.getAttribute("ores")),
			water: parseFloat(li.getAttribute("water")),
			oil: parseFloat(li.getAttribute("oil")),
			gas: parseFloat(li.getAttribute("gas"))
		};
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
			id: parseInt(processIdInput.value, 10),
			amount: parseInt(processAmountInput.value, 10)
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
					let selectedProcessMetrics = {
						economic: 0,
						social: 0,
						human: 0,
						ground: 0,
						ores: 0,
						water: 0,
						oil: 0,
						gas: 0,
						co2eqEmission: 0
					};

					allProcesses.forEach(process => {
						function findProcessById(processes, id) {
							return processes ? processes.find(process => process.id === id) : null;
						}
						const usage = findProcessById(country.processes, process.id);
						if ( usage ) {
							const amount = usage.usage_count;
							selectedProcessMetrics.economic += processRetrieveMetric(allProcesses, process, "economic") * amount || 0;
							selectedProcessMetrics.social += processRetrieveMetric(allProcesses, process, "social") * amount || 0;
							selectedProcessMetrics.human += processRetrieveMetric(allProcesses, process, "human") * amount || 0;
							selectedProcessMetrics.ground += processRetrieveMetric(allProcesses, process, "ground") * amount || 0;
							selectedProcessMetrics.ores += processRetrieveMetric(allProcesses, process, "ores") * amount || 0;
							selectedProcessMetrics.water += processRetrieveMetric(allProcesses, process, "water") * amount || 0;
							selectedProcessMetrics.oil += processRetrieveMetric(allProcesses, process, "oil") * amount || 0;
							selectedProcessMetrics.gas += processRetrieveMetric(allProcesses, process, "gas") * amount || 0;
							selectedProcessMetrics.co2eqEmission += processRetrieveMetric(allProcesses, process, "envEmissions") * amount || 0;
						}
					});

					document.getElementById('total-economic').textContent = `${selectedProcessMetrics.economic}`;
					document.getElementById('total-social').textContent = `${selectedProcessMetrics.social}`;
					document.getElementById('total-co2eq-emissions').textContent = `${selectedProcessMetrics.co2eqEmission}`;
					document.getElementById('total-human-used').textContent = `${selectedProcessMetrics.human}`;
					document.getElementById('total-ground-used').textContent = `${selectedProcessMetrics.ground}`;
					document.getElementById('total-ores-used').textContent = `${selectedProcessMetrics.ores}`;
					document.getElementById('total-water-used').textContent = `${selectedProcessMetrics.water}`;
					document.getElementById('total-oil-used').textContent = `${selectedProcessMetrics.oil}`;
					document.getElementById('total-gas-used').textContent = `${selectedProcessMetrics.gas}`;
					
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

					document.getElementById('time-human-depletion').textContent = getTimeToDepletion(countryResources.human.amount, countryResources.human.renew_rate, selectedProcessMetrics.human);
					document.getElementById('time-ground-depletion').textContent = getTimeToDepletion(countryResources.ground.amount, countryResources.ground.renew_rate, selectedProcessMetrics.ground);
					document.getElementById('time-ores-depletion').textContent = getTimeToDepletion(countryResources.ores.amount, countryResources.ores.renew_rate, selectedProcessMetrics.ores);
					document.getElementById('time-water-depletion').textContent = getTimeToDepletion(countryResources.water.amount, countryResources.water.renew_rate, selectedProcessMetrics.water);
					document.getElementById('time-oil-depletion').textContent = getTimeToDepletion(countryResources.oil.amount, countryResources.oil.renew_rate, selectedProcessMetrics.oil);
					document.getElementById('time-gas-depletion').textContent = getTimeToDepletion(countryResources.gas.amount, countryResources.gas.renew_rate, selectedProcessMetrics.gas);
					document.getElementById('time-co2eq-saturation').textContent = getTimeToDepletion(countryResources.co2capacity.amount, countryResources.co2capacity.renew_rate, selectedProcessMetrics.co2eqEmission);
				});

			updateRadarChart(selectedProcessMetrics.economic, selectedProcessMetrics.co2eqEmission, selectedProcessMetrics.social);

			data.forEach(process => {
				const li = document.createElement('li');
				li.classList.add("list-group-item");
				li.setAttribute("process-id", process.id);
				li.setAttribute("economic", process.metrics.economic);
				li.setAttribute("env-emissions", process.metrics.envEmissions);
				li.setAttribute("social", process.metrics.social);
				li.setAttribute("human", process.metrics.human);
				li.setAttribute("ground", process.metrics.ground);
				li.setAttribute("ores", process.metrics.ores);
				li.setAttribute("water", process.metrics.water);
				li.setAttribute("oil", process.metrics.oil);
				li.setAttribute("gas", process.metrics.gas);
				li.setAttribute("title", process.title);
				li.setAttribute("process-amount", process.amount);
				const compoStr = JSON.stringify(process.composition);
				li.setAttribute("process-composition", compoStr);

				li.innerHTML = `
					<div class="card mb-3">
						<div class="card-header d-flex justify-content-between align-items-center">
							<form action="/select_process" method="POST">
								<input type="checkbox" ${process.selected ? "checked" : ""}>
								<input type="hidden" name="id" value="${process.id}">
								<input type="hidden" name="selected" value="${process.selected ? 1 : 0}">
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
										<li><input type="number" class="form-control mt-2" id="view-process-amount-${process.id}" value="${process.amount}" /></li>
									</ul>
								</div>
								<div class="col-md-4">
									<h6>Resources Used</h6>
									<ul class="list-unstyled">
										<li>Human: ${process.metrics.human || 0}</li>
										<li>Ground: ${process.metrics.ground || 0}</li>
										<li>Ores: ${process.metrics.ores || 0}</li>
										<li>Water: ${process.metrics.water || 0}</li>
										<li>Oil: ${process.metrics.oil || 0}</li>
										<li>Gas: ${process.metrics.gas || 0}</li>
									</ul>
								</div>
								<div class="col-md-4">
									<h6>Resources Produced</h6>
									<ul class="list-unstyled">
										<li>Economic: ${process.metrics.economic} $</li>
										<li>Environmental: ${process.metrics.envEmissions} kgCO2eq</li>
										<li>Social: ${process.metrics.social}</li>
									</ul>
								</div>
							</div>
							<hr>
							<div class="row">
								<h6 class="mt-3">Cumulative Metrics</h6>
							</div>
							<div class="row">
								<div class="col-md-4">
									For ${processNSubProcess(data,process)} subprocess
								</div>
								<div class="col-md-4">
									<h6>Resources Used</h6>
									<ul class="list-unstyled">
										<li>Human: ${processRetrieveMetric(data, process, "human")}</li>
										<li>Ground: ${processRetrieveMetric(data, process, "ground")}</li>
										<li>Ores: ${processRetrieveMetric(data, process, "ores")}</li>
										<li>Water: ${processRetrieveMetric(data, process, "water")}</li>
										<li>Oil: ${processRetrieveMetric(data, process, "oil")}</li>
										<li>Gas: ${processRetrieveMetric(data, process, "gas")}</li>
									</ul>
								</div>
								<div class="col-md-4">
									<h6>Resources Produced</h6>
									<ul class="list-unstyled">
										<li>Economic: ${processRetrieveMetric(data, process, "economic")} $</li>
										<li>Environmental: ${processRetrieveMetric(data, process, "envEmissions")} kgCO2eq</li>
										<li>Social: ${processRetrieveMetric(data, process, "social")}</li>
									</ul>
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

				const compositionContainer = li.querySelector(`#composition-container-${process.id}`);
				process.composition.forEach(composition => {
					const compositionDiv = createCompositionDiv(process, composition);
					compositionContainer.appendChild(compositionDiv);
				});

				const amountInput = li.querySelector(`#view-process-amount-${process.id}`);
				amountInput.addEventListener('change', () => {
					const newAmount = amountInput.value;
					fetch(`/update_process_amount`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							id: process.id,
							amount: newAmount
						})
					})
					.then(response => response.json())
					.then(updatedProcess => {
						console.log(`Process ${updatedProcess.id} amount updated to ${updatedProcess.amount}`);
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

				processList.appendChild(li);
			});
		})
		.catch(error => {
			console.error('There was a problem fetching processes:', error.message);
		});
}

function attachSelectedEvent() {
	// Select form submission event listener
	const selectForms = document.querySelectorAll('.select-form');
	selectForms.forEach(form => {
		form.addEventListener('submit', function(event) {
			event.preventDefault();
			event.stopPropagation(); // Prevent other event handlers from being called
						
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

document.addEventListener('DOMContentLoaded', function () {

	setupExportDatabaseElement(document.getElementById('export-database-btn'));
	setupImportDatabaseElement(document.getElementById('import-database-file'));

	const compositionContainer = document.getElementById('add-process-composition-container');
	const addCompositionBtn = document.getElementById('add-process-add-composition');

	updateRadarChart(0, 0, 0);

	fetch('/get_country')
		.then(response => response.json())
		.then(country => {
			const data = country.resources;
			document.getElementById('human-resources').value = data.human.amount;
			document.getElementById('human-resources-renew').value = data.human.renew_rate;
			document.getElementById('ground-resources').value = data.ground.amount;
			document.getElementById('ground-resources-renew').value = data.ground.renew_rate;
			document.getElementById('ores-resources').value = data.ores.amount;
			document.getElementById('ores-resources-renew').value = data.ores.renew_rate;
			document.getElementById('water-resources').value = data.water.amount;
			document.getElementById('water-resources-renew').value = data.water.renew_rate;
			document.getElementById('oil-resources').value = data.oil.amount;
			document.getElementById('oil-resources-renew').value = data.oil.renew_rate;
			document.getElementById('gas-resources').value = data.gas.amount;
			document.getElementById('gas-resources-renew').value = data.gas.renew_rate;
			document.getElementById('co2-capacity-resources').value = data.co2capacity.amount;
			document.getElementById('co2-capacity-absorption').value = data.co2capacity.renew_rate;
		});

	document.getElementById('btn-set-resources').addEventListener('click', () => {
		const resources = {
			human: document.getElementById('human-resources').value || 0,
			human_renew_rate: document.getElementById('human-resources-renew').value || 0,
			ground: document.getElementById('ground-resources').value || 0,
			ground_renew_rate: document.getElementById('ground-resources-renew').value || 0,
			ores: document.getElementById('ores-resources').value || 0,
			ores_renew_rate: document.getElementById('ores-resources-renew').value || 0,
			water: document.getElementById('water-resources').value || 0,
			water_renew_rate: document.getElementById('water-resources-renew').value || 0,
			oil: document.getElementById('oil-resources').value || 0,
			oil_renew_rate: document.getElementById('oil-resources-renew').value || 0,
			gas: document.getElementById('gas-resources').value || 0,
			gas_renew_rate: document.getElementById('gas-resources-renew').value || 0,
			co2capacity: document.getElementById('co2-capacity-resources').value || 0,
			co2capacity_renew_rate: document.getElementById('co2-capacity-absorption').value || 0
		};
		fetch('/set_country', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(resources)
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

		const processForm = document.getElementById('add-process-form');
		const process = {
			title: document.getElementById('add-process-title').value || '',
			amount: parseInt(document.getElementById('add-process-amount').value) || 0,  
			tags: document.getElementById('add-process-tags').value || '', 
			metrics: {
				human: parseFloat(document.getElementById('add-process-metric-human').value) || 0,
				ground: parseFloat(document.getElementById('add-process-metric-ground').value) || 0,
				ores: parseFloat(document.getElementById('add-process-metric-ores').value) || 0,
				water: parseFloat(document.getElementById('add-process-metric-water').value) || 0,
				oil: parseFloat(document.getElementById('add-process-metric-oil').value) || 0,
				gas: parseFloat(document.getElementById('add-process-metric-gas').value) || 0,
				economic: parseFloat(document.getElementById('add-process-metric-economic').value) || 0, 
				envEmissions: parseFloat(document.getElementById('add-process-metric-envEmissions').value) || 0, 
				social: parseInt(document.getElementById('add-process-metric-social').value) || 0 
			},
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