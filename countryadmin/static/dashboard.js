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

// recursively compute the metric of a process
function processRetrieveMetric(allProcesses,process,metric) {
	let total = 0;
	function getProcessById(processes, id) {
		return processes.find(process => process.id === id);
	}
	for(let compo of process.composition) {
		let compoProcess = getProcessById(allProcesses,compo.id);
		if( compoProcess === undefined ) {
			console.warn("process with id " + compo.id + " is not in the retrieved processes.");
		} else {
			total += processRetrieveMetric(allProcesses,compoProcess,metric) * compo.amount;
		}
	}
	return total + process.metrics[metric];
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
		const distanceEconomic = Math.abs(process.amount * processRetrieveMetric(allProcesses,process,"economic") - goalEconomic);
		const distanceEnvEmissions = Math.abs(process.amount * processRetrieveMetric(allProcesses,process,"envEmissions") - goalEnvEmissions);
		const distanceSocial = Math.abs(process.amount * processRetrieveMetric(allProcesses,process,"social") - goalSocial);
		return distanceEconomic + distanceEnvEmissions + distanceSocial;
	};

	// Select processes based on goals
	const selectedProcessIds = new Set();
	processMap.forEach(processes => {
		let minDistance = Infinity;
		let closestProcess = null;
		for (const process of processes) {
			if (!selectedProcessIds.has(process.processId)) {
				const distance = calculateDistance(allProcesses,process, economicGoal - totalEconomic, govGoalEnvEmissions - selectedGovEnvEmissions, socialGoal - totalSocial);
				if (distance < minDistance) {
					minDistance = distance;
					closestProcess = process;
				}
			}
		}
		if (closestProcess) {
			closestProcess.selected = true;
			selectedProcessIds.add(closestProcess.processId);
			totalEconomic += processRetrieveMetric(allProcesses,closestProcess,"economic") * closestProcess.amount;
			selectedGovEnvEmissions += processRetrieveMetric(allProcesses,closestProcess,"envEmissions") * closestProcess.amount;
			totalSocial += processRetrieveMetric(allProcesses,closestProcess,"social") * closestProcess.amount;
		}
	});
	
	const formData = new FormData();
	allProcesses.forEach(process => {
		formData.append('id[]', process.id);
		formData.append('selected[]', process.selected);
	});

	var p = fetch('/select_process', {
		method: 'POST',
		body: formData
	})
	p
		.then(() => fetchProcesses())
		.catch(function(e){
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

function deleteProcess(processId) {
	console.warn("deleteProcess", processId);
	fetch(`/delete_process/${processId}`, {
		method: 'POST'
	})
	.then(response => response.json())
	.then(data => {
		if (data.success) {
			fetchProcesses();
		} else {
			console.error('Error deleting process:', data.error);
		}
	})
	.catch(error => console.error('Error deleting process:', error));
}

async function fetchProcesses() {
	// Clear previous processes
	return fetch('/get_processes')
		.then(response => {
			if (!response.ok) {
				throw new Error('Network response was not ok');
			}
			return response.json();
		})
		.then(data => {
			const processList = document.getElementById('process-list');

			processList.innerHTML = '';
			const selectedProcesses = data.filter(process => process.selected);
			const totalEconomic = selectedProcesses.reduce((total, process) => total + processRetrieveMetric(data, process, "economic") * process.amount, 0);
			const selectedGovEnvEmissions = selectedProcesses.reduce((total, process) => total + processRetrieveMetric(data, process, "envEmissions") * process.amount, 0);
			const totalSocial = selectedProcesses.reduce((total, process) => total + processRetrieveMetric(data, process, "social") * process.amount, 0);

			document.getElementById('total-economic').textContent = `${totalEconomic}`;
			document.getElementById('selected-governance-env-emissions').textContent = `${selectedGovEnvEmissions}`;
			document.getElementById('total-social').textContent = `${totalSocial}`;

			data.forEach(process => {
				const li = document.createElement('li');
				li.classList.add("list-group-item");
				li.setAttribute("process-id", process.id);
				li.setAttribute("economic", process.metrics.economic);
				li.setAttribute("env-emissions", process.metrics.envEmissions);
				li.setAttribute("social", process.metrics.social);
				li.setAttribute("title", process.title);
				li.setAttribute("process-amount", process.amount);
				const compoStr = JSON.stringify(process.composition);
				li.setAttribute("process-composition", compoStr);

				// Calculate cumulative metrics
				const cumulativeEconomic = processRetrieveMetric(data, process, "economic");
				const cumulativeEnvEmissions = processRetrieveMetric(data, process, "envEmissions");
				const cumulativeSocial = processRetrieveMetric(data, process, "social");

				li.innerHTML = `
					<div class="d-flex justify-content-between">
						<div>
							<strong>${process.title}</strong> (ID: ${process.id})<br>
							<ul>
								<li>Economic: ${process.metrics.economic} $</li>
								<li>Environmental: ${process.metrics.envEmissions} kgCO2eq</li>
								<li>Social: ${process.metrics.social}</li>
								<li>Amount: ${process.amount}</li>
								<li><strong>Cumulative Metrics</strong>:
									<ul>
										<li>Economic: ${cumulativeEconomic} $</li>
										<li>Environmental: ${cumulativeEnvEmissions} kgCO2eq</li>
										<li>Social: ${cumulativeSocial}</li>
									</ul>
								</li>
							</ul>
						</div>
						<div>
							<button class="btn btn-danger" onclick="deleteProcess(${process.id})">Delete</button>
						</div>
					</div>
					<h5>Composition</h5>
					<div id="composition-container-${process.id}">
					</div>
				`;

				// Add composition elements
				const compositionContainer = li.querySelector(`#composition-container-${process.id}`);
				process.composition.forEach(composition => {
					const compositionDiv = createCompositionDiv(process, composition);
					compositionContainer.appendChild(compositionDiv);
				});

				// Add form and checkbox for selection
				const form = document.createElement('form');
				form.setAttribute('action', '/select_process');
				form.setAttribute('method', 'POST');
				const checkbox = document.createElement('input');
				checkbox.setAttribute('type', 'checkbox');
				checkbox.setAttribute('value', process.selected);
				if (process.selected) {
					checkbox.setAttribute('checked', '');
				}
				const checkboxS = document.createElement('input');
				checkboxS.setAttribute('type', 'number');
				checkboxS.setAttribute('name', 'selected');
				checkboxS.setAttribute('hidden', '');

				const idInput = document.createElement('input');
				idInput.setAttribute('type', 'number');
				idInput.setAttribute('name', 'id');
				idInput.setAttribute('value', process.id);
				idInput.setAttribute('hidden', '');
				form.appendChild(checkbox);
				form.appendChild(idInput);
				form.appendChild(checkboxS);
				li.appendChild(form);

				const amountInput = document.createElement('input');
				amountInput.setAttribute('type', 'number');
				amountInput.value = process.amount;
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
				li.appendChild(amountInput);
				processList.appendChild(li);

				checkbox.addEventListener('click', function (e) {
					checkboxS.value = checkbox.checked ? 1 : 0;
					form.submit();
				});
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

document.addEventListener('DOMContentLoaded', function() {

	const compositionContainer = document.getElementById('add-process-composition-container');
    const addCompositionBtn = document.getElementById('add-process-add-composition');

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
			
	document.getElementById("btn-adjust").addEventListener("click",selectProcesses);

    // Fetch processes when the page loads
    fetchProcesses();
		
	attachSelectedEvent();
		
    const submitBtn = document.getElementById('submit-btn');
    const processForm = document.getElementById('process-form');

    submitBtn.addEventListener('click', function(event) {
		event.preventDefault();
			
        // Serialize form data
        const formData = new FormData(processForm);

		let compositionData = [];
		document.querySelectorAll('.composition-process-group').forEach(group => {
			compositionData.push({ 
				id: parseInt(group.querySelector('input[name="composition-process-id"]').value), 
				amount: parseInt(group.querySelector('input[name="composition-process-amount"]').value)
			});
		});
		const compositionJSON = JSON.stringify(compositionData);
		formData.append('composition', compositionJSON);

        // Send form data asynchronously
        fetch(processForm.action, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
             fetchProcesses();
            return response.text();
        })
        .then(data => {
            console.log('Process submitted successfully:', data);
						attachSelectedEvent();
            // Optionally, update the page with new data or display a success message
        })
        .catch(error => {
            console.error('There was a problem with the process submission:', error.message);
            // Optionally, display an error message to the user
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

	// Import button functionality
	document.getElementById('import-file').addEventListener('change', function(event) {
		const file = event.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = function(event) {
				const processes = JSON.parse(event.target.result);
				for(let process of processes) {
					// Serialize form data
					const formData = new FormData();
					formData.append('id',process.id);
					formData.append('economic', process.metrics.economic);
					formData.append('envEmissions', process.metrics.envEmissions);
					formData.append('process_id', process.process_id);
					formData.append('title', process.title);
					formData.append('social', process.metrics.social);
					formData.append('selected', process.selected);
					formData.append('process-amount', process.amount);
					formData.append('composition', JSON.stringify(process.composition));
																			
					// Send form data asynchronously
					fetch("/set_process", {
						method: 'POST',
						body: formData
					})
					.then(response => {
						if (!response.ok) {
							throw new Error('Network response was not ok');
						}
						fetchProcesses();
						return response.text();
					})
					.then(data => {
						console.log('Process submitted successfully:', data);
						attachSelectedEvent();
						// Optionally, update the page with new data or display a success message
					})
					.catch(error => {
						console.error('There was a problem with the process submission:', error.message);
						// Optionally, display an error message to the user
					});
				}
			};
			reader.readAsText(file);
		}
	});
});
