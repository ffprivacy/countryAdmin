async function userPanelRefresh() {
    return fetchAreaAPI(`/user/${USER_DATA['user_id']}`)
        .then(async function (data) {
            document.getElementById("user-username").textContent = data.username;
            
            tokenList = document.getElementById("user-tokens-list");
            tokenList.innerHTML = '';
            for(let token of ['admin','admin']) {
                const tokenElement = document.createElement("div");
                tokenElement.textContent = token;
                tokenList.appendChild(tokenElement);
            }
        })
}
document.addEventListener('DOMContentLoaded', async function () {
    userPanelRefresh()
})