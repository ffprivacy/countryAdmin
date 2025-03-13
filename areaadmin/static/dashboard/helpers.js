function setupExportDatabaseElement(e) {
    e.addEventListener('click', function() {
        window.location.href = '/api/database';
    });
}
function setupImportDatabaseElement(e) {
    e.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
    
            fetch('/api/database', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    alert('Database imported successfully. Please refresh the page.');
                } else {
                    alert('Failed to import database.');
                }
            })
            .catch(error => {
                console.error('There was a problem importing the database:', error.message);
            });
        }
    });
}
function tradesSetup() {
	fetchTrades();
}
function areaResourcesFillDefault() {
    for(let area in areaResourcesDefaults) {
        const list = document.getElementById("area-prefill");
        const opt = document.createElement("option");
        opt.value = area;
        opt.innerText = area;
        list.appendChild(opt);
    }
}
function areaResourcesSetup(prefix) {
    const container = document.getElementById(prefix);

    container.innerHTML = '';
    for(let object of Processes.processesGetObjects()) {
        container.innerHTML += ` <div class="row">
                                    <div class="col">
                                        <img src="/static/${object.icon}" class="ms-2" style="max-width: 50px;" />${object.description}
                                    </div>
                                    <div class="col">
                                        <div class="form-group row">
                                            <label for="${prefix}-${object.id}-amount" class="col-sm-4 col-form-label">Amount</label>
                                            <div class="col-sm-8">
                                                <input type="number" class="form-control" id="${prefix}-${object.id}-amount" name="${prefix}-${object.id}-amount">
                                            </div>
                                        </div>
                                        <div class="form-group row">
                                            <label for="${prefix}-${object.id}-renew-rate" class="col-sm-4 col-form-label">Renew rate</label>
                                            <div class="col-sm-8">
                                                <input type="number" class="form-control" id="${prefix}-${object.id}-renew-rate" name="${prefix}-${object.id}-renew-rate">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <hr>`;
    }

    fetchAreaAPI('/area')
    .then(area => {
        const data = area.resources;
        for(let metric of Processes.processesGetObjectsIds()) {
            document.getElementById(`${prefix}-${metric}-amount`).value = data[metric] ? data[metric].amount || 0 : 0;
            document.getElementById(`${prefix}-${metric}-renew-rate`).value = data[metric] ? data[metric].renew_rate || 0 : 0;
        }
    });

    document.getElementById('btn-set-resources').addEventListener('click', () => {
        const resources = {};
        for(let metric of Processes.processesGetObjectsIds()) {
            resources[metric] = {
                amount: parseFloat(document.getElementById(`${prefix}-${metric}-amount`).value) || 0,
                renew_rate: parseFloat(document.getElementById(`${prefix}-${metric}-renew-rate`).value) || 0
            };
        }
        fetchAreaAPI('/area', {
            method: 'POST',
            body: JSON.stringify({resources: resources})
        }).then(data => {
                if (data.success) {
                    dashboardRefresh();
                }
            });
    });

    areaResourcesFillDefault();
}
function updateTrade(tradeId) {
    const data = {
        home_processes: getTradeDetails('home', tradeId),
        home_confirm: document.getElementById(`trade-status-${tradeId}`).checked
    };

    fetchAreaAPI(`/trade/${tradeId}`, {
        method: 'POST',
        body: JSON.stringify(data)
    })
    .then(data => {
        if ( ! data.message ) {
            alert(data.error);
        }
        fetchTrades();
    })
    .catch(error => console.error('Error updating trade:', error));
}
function deleteTrade(tradeId) {
    fetchAreaAPI(`/trade/${tradeId}`, {
        method: 'DELETE'
    })
    .then(data => {
        if ( ! data.message ) {
            alert(data.error);
        }
        fetchTrades();
    })
    .catch(error => console.error('Error deleting trade:', error));
}
function getTradeDetails(type, tradeId) {
    let details = [];
    const tradeProcesses = document.querySelectorAll(`#trade-${tradeId}-${type}-processes > .trade-${tradeId}-${type}-process`);
    tradeProcesses.forEach(tradeProcess => {
        details.push({
            id: parseInt(tradeProcess.querySelector(`#process-id`).value), 
            amount: parseInt(tradeProcess.querySelector(`#process-amount`).value)
        });
    });
    return details;
}