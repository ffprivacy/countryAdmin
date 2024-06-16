Manage a area or a group of people with more horizontal decision.
It assume a predation based world.
### Install
#### From source
```bash
conda create -n areaAdmin python=3.11 && \
    conda activate areaAdmin && \
    pip install git+https://github.com/ffprivacy/areaAdmin.git#egg=areaAdmin
```
#### From GitHub
Download a release from [releases](https://github.com/ffprivacy/areaAdmin/releases), then
```bash
conda create -n areaAdmin python=3.11 && \
    conda activate areaAdmin && \
    pip install areaAdmin-*.whl
```

### Run 
```
areaAdmin
```
### Develop
#### Install
```bash
conda create -y -n areaAdmin python=3.11 ; \
    conda activate areaAdmin && \
    pip install poetry && \
    poetry install --no-root && \
    pip install -e .
```
#### Build
```bash
poetry build
```
