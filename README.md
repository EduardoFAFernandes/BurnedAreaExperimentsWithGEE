# Burned Area Experiments With Google Earth Engine (GEE)
These are the [Google Earth Engine](https://earthengine.google.com) scripts used in my [APDC investigação](https://sites.google.com/campus.fct.unl.pt/apdc-inv-2018) project, at [FCT-UNL](https://www.fct.unl.pt/en).
These scripts run in the [online code editor](https://code.earthengine.google.com), you may need to register in order to use the platform.
You can access these files in the code editor repositories [here](https://code.earthengine.google.com/?accept_repo=users/efafernandes_FCT-UNL/GEE_Burned_Area_Experiments).

# The idea
The main idea of the project was to use Google Earth Engine to detect burnt area. The location chosen was a county in Aveiro, Portugal. All the scripts create two images a pre-fire image and a post-fire image. Only the Sentinel-2 collection is used.

# File Descriptions
## 01_DeltaNDVI_Threshold
Classifying burned area based on a hand-chosen threshold for the difference of NDVI between two dates.

## 02_MultipleDeltas_Threshold
The same as the previous file but other indices are used, namely: NBR1, NBR2, and EVI.

## 03_Classifiers
Classifying the burned area with multiple indices and using the available classifiers GEE provides.

## 04_Smoothing_Post_Classification
Applying a basic smoothing algorithm **after** the classification.

## 04_Smoothing_Pre_Classification
Applying a basic smoothing algorithm **before** the classification with hopes to reduce noise.

## 05_StratifiedRandomSampling
Implementing a stratified random sampling to get the train data.

## 06_Masking_Zones
Just masking zones that would never burn.
