function setupExportDatabaseElement(e) {
    e.addEventListener('click', function() {
        window.location.href = '/export_database';
    });
}
function setupImportDatabaseElement(e) {
    e.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
    
            fetch('/import_database', {
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
function addProcessMetricsForm(sens='input') {
    const container = document.createElement('div');
    container.className = 'col-md-6';

    processMetricsGetList().forEach(metric => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.htmlFor = `add-process-metric-${sens}-${metric.id}`;
        label.textContent = metric.label;
        formGroup.appendChild(label);

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'form-control';
        input.id = `add-process-metric-${sens}-${metric.id}`;
        input.name = `add-process-metric-${sens}-${metric.id}`;
        input.value = 0;
        formGroup.appendChild(input);

        container.appendChild(formGroup);
    });

    document.getElementById(`add-process-metrics-${sens}`).appendChild(container);
}

function countryResourcesSetElements(prefix) {
    const container = document.getElementById(prefix);

    container.innerHTML = '';
    for(let metric of processMetricsGetList()) {
        container.innerHTML += ` <div class="row">
                                    <div class="col">
                                        <img src="/static/${metric.icon}" class="ms-2" style="max-width: 50px;" />${metric.label}
                                    </div>
                                    <div class="col">
                                        <div class="form-group row">
                                            <label for="${prefix}-${metric.id}-amount" class="col-sm-4 col-form-label">Amount</label>
                                            <div class="col-sm-8">
                                                <input type="number" class="form-control" id="${prefix}-${metric.id}-amount" name="${prefix}-${metric.id}-amount">
                                            </div>
                                        </div>
                                        <div class="form-group row">
                                            <label for="${prefix}-${metric.id}-renew-rate" class="col-sm-4 col-form-label">Renew rate</label>
                                            <div class="col-sm-8">
                                                <input type="number" class="form-control" id="${prefix}-${metric.id}-renew-rate" name="${prefix}-${metric.id}-renew-rate">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <hr>`;
    }
}