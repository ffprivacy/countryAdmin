class Processes {

    static getById(processes, id) {
        return processes.find(process => process.id === id);
    }

    static retrieveMetric(allProcesses, process, sens, metric) {
        let total = 0;
        for (let compo of process.composition) {
            let compoProcess = Processes.getById(allProcesses, compo.id);
            if (compoProcess) {
                const metric2 = Processes.retrieveMetric(allProcesses, compoProcess, sens, metric);
                total += metric2 * compo.amount;
            } else {
                console.warn(`process with id ${compo.id} is not in the retrieved processes.`);
            }
        }
        return total + process.metrics[sens][metric];
    }

    static processes_objects = [];
    
    static async fetchObjects() {
        return fetchAreaAPI('/processes/objects').then(processes_objects => {
            return (Processes.processes_objects = processes_objects.map(item => {
                const iconMapping = {
                    1: 'human.png',
                    2: 'economic.png',
                    3: 'carbon.png',
                    4: 'human.png',
                    5: 'land.png',
                    6: 'ore2.png',
                    7: 'water_drop.png',
                    8: 'oil.png',
                    9: 'gas.png',
                    10: 'smoke.png'
                };
                return {
                    ...item,
                    icon: "media/" + ( iconMapping[item.id] || 'default_icon.png' )
                };
            }));
        })
    }
    
    static metricsGetList() {
        return Processes.processes_objects;
    }

    static metricsGetIdsList() {
        return Processes.metricsGetList().map(obj => obj.id);
    }

    static countSubProcesses(allProcesses, process) {
        let total = 0;
        for (let compo of process.composition) {
            let compoProcess = Processes.getById(allProcesses, compo.id);
            if (compoProcess) {
                total += 1;
            } else {
                console.warn(`process with id ${compo.id} is not in the retrieved processes.`);
            }
        }
        return total;
    }

    static delete(process_id) {
        return fetchAreaAPI(`/process/${process_id}`, { method: 'DELETE' })
        .then(data => {
            dashboardRefresh();
            console.log('Process deleted successfully.');
        }).catch(error => {
            console.error('Error deleting process:', error);
        });
    }

    static set(process) {
        return fetchAreaAPI(`/set_process`, {
            method: 'POST',
            body: JSON.stringify(process)
        }).then(data => {
            console.log('Process submitted successfully:', data);
        }).catch(error => {
            console.error('Error submitting process:', error);
        });
    }

    static addComment(process_id, comment) {
        return fetchAreaAPI(`/process/${process_id}/add_comment`, {
            method: 'POST',
            body: JSON.stringify({ comment: comment })
        }).then(data => {
            dashboardRefresh();
            console.log('Comment added successfully.');
        }).catch(error => {
            console.error('Error adding comment:', error);
        });
    }

    static dislike(process_id) {
        return fetchAreaAPI(`/process/${process_id}/dislike`, {
            method: 'POST'
        }).then(data => {
            if (data.success) {
                dashboardRefresh();
            } else {
                console.error('Error disliking process:', data.error);
            }
        }).catch(error => {
            console.error('Error disliking process:', error);
        });
    }

    static like(process_id) {
        return fetchAreaAPI(`/process/${process_id}/like`, {
            method: 'POST'
        }).then(data => {
            if (data.success) {
                dashboardRefresh();
            } else {
                console.error('Error liking process:', data.error);
            }
        }).catch(error => {
            console.error('Error liking process:', error);
        });
    }

    static compositionUpdate(process_id, composition) {
        return fetchAreaAPI(`/process/${process_id}/composition`, {
            method: 'POST',
            body: JSON.stringify(composition)
        })
        .then(data => {
            if (data.success) {
                dashboardRefresh();
            } else {
                console.error('Error updating composition:', data.error);
            }
        }).catch(error => {
            console.error('Error updating composition:', error);
        });
    }
    
    static compositionDelete(process_id, compositionId) {
        return fetchAreaAPI(`/process/${process_id}/composition/${compositionId}`, {
            method: 'DELETE'
        })
        .then(data => {
            if (data.success) {
                dashboardRefresh();
            } else {
                console.error('Error deleting composition:', data.error);
            }
        }).catch(error => {
            console.error('Error deleting composition:', error);
        });
    }
}