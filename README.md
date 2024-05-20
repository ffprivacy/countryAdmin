Utopia assume predationless people

### Install
#### From source
```bash
conda create -n countryAdmin python=3.11 && \
    conda activate countryAdmin && \
    pip install git+https://github.com/ffprivacy/countryAdmin.git#egg=countryAdmin
```
#### From GitHub
Download a release from [releases](https://github.com/ffprivacy/countryAdmin/releases), then
```bash
conda create -n countryAdmin python=3.11 && \
    conda activate countryAdmin && \
    pip install countryAdmin-*.whl
```

### Run 
```
countryAdmin
```
### Develop
#### Install
```bash
conda create -y -n countryAdmin python=3.11 ; \
    conda activate countryAdmin && \
    pip install poetry && \
    poetry install --no-root && \
    pip install -e .
```
#### Build
```bash
poetry build
```
