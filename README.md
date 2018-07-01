# Burned Area Experiments With Google Earth Engine (GEE)
These are the [Google Earth Engine](https://earthengine.google.com) scripts used in my [APDC investigação](https://sites.google.com/campus.fct.unl.pt/apdc-inv-2018) project, at [FCT-UNL](https://www.fct.unl.pt/en).
These scripts run in the [online code editor](https://code.earthengine.google.com), you may need to register in order to use the platform.
You can access these files in the code editor repositories [here](https://code.earthengine.google.com/?accept_repo=users/efafernandes_FCT-UNL/GEE_Burned_Area_Experiments).

# The idea
The main idea of the project was to use Google Earth Engine to detect burnt area. The location chosen was a county in Aveiro, Portugal. This was an iterative project, that started on a simple sicript *01_DeltaNDVI_Threshold*, each file is an and after some revisions ended up with script *06_Masking_Zones*.

# Input
All the scripts create two images a pre-fire image and a post-fire image from Sentinel-2 images. Below you can see  color composite images (**R**-SWIR, **G**-NIR, **B**-RED) of study area pre and post-fire.

![prefireimg](https://user-images.githubusercontent.com/15330490/42136045-8bad6b3e-7d4c-11e8-82ca-f4f871ef437a.png) |  ![postfireimg](https://user-images.githubusercontent.com/15330490/42136051-972272b6-7d4c-11e8-821b-a6efe8abe86b.png)
:-------------------------:|:-------------------------:
Pre-Fire Image             |  Post-Fire Image

# Outputs
From these images the script creates a classification image 0 mean not burn 1 means burnt. We need to compare it to our groud truth, a [shapefile with the 2016](http://www2.icnf.pt/portal/florestas/dfci/inc/info-geo) fires from [ICNF](http://www.icnf.pt). GEE provides metrics like accuracy and kappa but there is also a need to see how the errors are distributed on the map. For that purpose confusion images are generated. These images show the official classification the scrip classification at the same time in order to understand where they differ. The folowing table depicts the color code used and the image is an example of an image using such color code.

![colorcode](https://user-images.githubusercontent.com/15330490/42139937-dc962d3c-7d8e-11e8-9cd0-671849a304db.png) | ![classification example](https://user-images.githubusercontent.com/15330490/42139959-6de12e72-7d8f-11e8-9666-e69c10c1c532.png)
:-------------------------:|:-------------------------:
Color Code                 |  Example Image


# File Descriptions
## 01_DeltaNDVI_Threshold
Classifying burnt area based on a hand-chosen threshold for the difference of NDVI between two dates.

First the NDVI (an index used in remote sensing) pre and post-fire is calculated in order to calculate the delta NDVI. After creating a histogram for the delta NDVI in burnt and non-burnt area we can select a range where the best threshold should be. 

![deltaNDVIHist](https://user-images.githubusercontent.com/15330490/42136296-87e73076-7d50-11e8-878c-6a18549f4245.png)
*burnt and non-burnt area delta NDVI histogram* 

After runing the script multiple times with diferent thresholds the best was -0.24, with a 0.9229 accuracy and 0.7719 kappa.

## 02_MultipleDeltas_Threshold
The same as the previous file but other indices are used, namely: NBR1, NBR2, and EVI.

NDVI is not the best index to use, so other indices were testes, the best was NBR1 with a threshold of -0,240 that the accuracy was 0.9236 and the kappa 0,7768.

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
