// dashboard.js
document.addEventListener('DOMContentLoaded', function() {
	
	const compositionContainer = document.getElementById('composition-container');
    const addCompositionBtn = document.getElementById('add-composition-btn');

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

	function getCompositionData() {
		const compositionContainer = document.getElementById('composition-container');
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
				throw "Error undefined";
			} else {
				total += processRetrieveMetric(allProcesses,compoProcess,metric) * compo.amount;
			}
		}
		return total + process.metrics[metric];
	}
	
	const processList = document.getElementById('process-list');

	function selectProcesses() {
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
		
	document.getElementById("btn-adjust").addEventListener("click",selectProcesses)
			
    // Function to fetch processes asynchronously
    function fetchProcesses() {
        fetch('/get_processes')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
			// Calculate total metrics for each kind in the selected governance
			const selectedProcesses = data.filter(process => process.selected);
			const totalEconomic = selectedProcesses.reduce((total, process) => total + processRetrieveMetric(data,process,"economic") * process.amount, 0);
			const selectedGovEnvEmissions = selectedProcesses.reduce((total, process) => total + processRetrieveMetric(data,process,"envEmissions") * process.amount, 0);
			const totalSocial = selectedProcesses.reduce((total, process) => total + processRetrieveMetric(data,process,"social") * process.amount, 0);

			// Update total metrics in the HTML
			document.getElementById('total-economic').textContent = `${totalEconomic}`;
			document.getElementById('selected-governance-env-emissions').textContent = `${selectedGovEnvEmissions}`;
			document.getElementById('total-social').textContent = `${totalSocial}`;
					
            // Clear previous processes
            processList.innerHTML = '';
            // Update the DOM with fetched processes
            data.forEach(process => {
                const li = document.createElement('li');
				li.setAttribute("process-id",process.process_id);
				li.setAttribute("economic",process.metrics.economic);
				li.setAttribute("env-emissions",process.metrics.envEmissions);
				li.setAttribute("social",process.metrics.social);
				li.setAttribute("title",process.title);
				li.setAttribute("process-amount",process.amount);
				const compoStr = JSON.stringify(process.composition);
				li.setAttribute("process-composition",compoStr);
                li.innerHTML = `${process.process_id}(id=${process.id}): ${process.title} ${process.metrics.economic}$ ${process.metrics.envEmissions}kgCO2eq ${process.metrics.social} social X ${process.amount} composed of ${compoStr}`;
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
				amountInput.setAttribute('type','number');
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
								
				checkbox.addEventListener('click',function(e){									
					checkboxS.value = checkbox.checked ? 1 : 0;
					form.submit();
				});
            });
        })
        .catch(error => {
            console.error('There was a problem fetching processes:', error.message);
            // Optionally, display an error message to the user
        });
    }

    // Fetch processes when the page loads
    fetchProcesses();

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
		document.getElementById('import-btn').addEventListener('click', function() {
			const importFile = document.getElementById('import-file').files[0];
			if (importFile) {
				const reader = new FileReader();
				reader.onload = function(event) {
					const processes = JSON.parse(event.target.result);
					for(let process of processes) {
						// Serialize form data
						const formData = new FormData();
						formData.append('economic', process.metrics.economic);
						formData.append('envEmissions', process.metrics.envEmissions);
						formData.append('process_id', process.process_id);
						formData.append('title', process.title);
						formData.append('social', process.metrics.social);
						formData.append('selected', process.selected);
						formData.append('amount', process.amount);
						formData.append('composition', JSON.stringify(process.composition));
																				
						// Send form data asynchronously
						fetch("/dashboard", {
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
				reader.readAsText(importFile);
	      	}
	  	});

});
