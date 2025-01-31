
import requests
from bs4 import BeautifulSoup

def extension_get_processes(*args):

    processes = []
    page_max = 1

    if 0 < len(args):
        page_max = int(args[0])

    for page in range(1,page_max+1):
        explore_url = f'http://www.lafabriquediy.com/?page={page}'

        print(f"Fetching {explore_url}")
        response = requests.get(explore_url)
        soup = BeautifulSoup(response.text, 'html.parser')
        tutorials = soup.select('.tutorialthumbnail')
        
        for tutorial in tutorials:
            title = tutorial.select_one(".screenshot-title > h1").text.strip()
            description = tutorial.select_one(".screenshot-title > p").text.strip()

            processes.append(
                {
                'title': title,
                'description': description,
                'metrics': {
                    'input': {},
                    'output': {}
                },
                'tags': []
            })
    return processes

def extension_display_help():
    print("args: [page no max]")