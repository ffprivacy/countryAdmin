import requests
from bs4 import BeautifulSoup

def fetch_tutorials(url):
    tutorials = []
    while True:
        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')
        tutorial_links = soup.select('.searchresults a[href*="/wiki/"]')

        for link in tutorial_links:
            title = link.text.strip()
            href = link.get('href')
            if href and title:
                tutorials.append({'title': title, 'url': f'https://wiki.lowtechlab.org{href}'})
        
        next_page = soup.find('a', text='Load more')
        if next_page:
            url = 'https://wiki.lowtechlab.org' + next_page['href']
        else:
            break

    return tutorials

# URL to the Explore page
explore_url = 'https://wiki.lowtechlab.org/wiki/Explore?page=1'
tutorials_list = fetch_tutorials(explore_url)
print(tutorials_list)
