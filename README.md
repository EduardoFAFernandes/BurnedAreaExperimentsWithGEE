# Burned Area Experiments With Google Earth Engine (GEE)
These are the [Google Earth Engine](https://earthengine.google.com) scripts used in my [APDC investigação](https://sites.google.com/campus.fct.unl.pt/apdc-inv-2018) project, at [FCT-UNL](https://www.fct.unl.pt/en).
These scripts run in the [online code editor](https://code.earthengine.google.com), you may need to register in order to use the platform.
You can access these files in the code editor repositories [here](https://code.earthengine.google.com/?accept_repo=users/efafernandes_FCT-UNL/GEE_Burned_Area_Experiments).

# The idea
The main idea of the project was to use Google Earth Engine to detect burnt area. The location chosen was a county in Aveiro, Portugal. This was an iterative project, that started on a simple script *01_DeltaNDVI_Threshold*, each file is an and after some revisions ended up with script *06_Masking_Zones*.

# Input
All the scripts create two images a pre-fire image and a post-fire image from Sentinel-2 images. Below you can see color composite images (**R**-SWIR, **G**-NIR, **B**-RED) of study area pre and post-fire.

![prefireimg](https://user-images.githubusercontent.com/15330490/42136045-8bad6b3e-7d4c-11e8-82ca-f4f871ef437a.png) |  ![postfireimg](https://user-images.githubusercontent.com/15330490/42136051-972272b6-7d4c-11e8-821b-a6efe8abe86b.png)
:-------------------------:|:-------------------------:
Pre-Fire Image             |  Post-Fire Image

# Outputs
From these images, the script creates a classification image where, 0 means not burnt 1 means burnt. We need to compare it to our ground truth, a [shapefile with the 2016 fires](http://www2.icnf.pt/portal/florestas/dfci/inc/info-geo) from [ICNF](http://www.icnf.pt). GEE provides metrics like accuracy and kappa but there is also a need to see how the errors are distributed on the map. For that purpose, confusion images are generated. These images show the official classification and the scrip classification at the same time in order to understand where they differ. The following table depicts the color code used and the image is an example of an image using such color code.

![colorcode](https://user-images.githubusercontent.com/15330490/42139937-dc962d3c-7d8e-11e8-9cd0-671849a304db.png) | ![classification example](https://user-images.githubusercontent.com/15330490/42139959-6de12e72-7d8f-11e8-9666-e69c10c1c532.png)
:-------------------------:|:-------------------------:
Color Code                 |  Example Image


# File Descriptions
## 01_DeltaNDVI_Threshold
Classifying burnt area based on a hand-chosen threshold for the difference of NDVI between two dates.

First, the NDVI (an index used in remote sensing) pre and post-fire is calculated in order to calculate the delta NDVI. After creating a histogram for the delta NDVI in the burnt and non-burnt area we can select a range where the best threshold should be. 

![deltaNDVIHist](https://user-images.githubusercontent.com/15330490/42136296-87e73076-7d50-11e8-878c-6a18549f4245.png)
*burnt and non-burnt area delta NDVI histogram* 

After running the script multiple times with different thresholds the best was -0.24, with a 0.9229 accuracy and 0.7719 kappa.

## 02_MultipleDeltas_Threshold
The same as the previous file but other indices are used, namely: NBR1, NBR2, and EVI.

NDVI is not the best index to use, so other indices were testes, the best was NBR1 with a threshold of -0,240 that the accuracy was 0.9236 and the kappa 0,7768.

## 03_Classifiers
Classifying the burned area with multiple indices and using the available classifiers GEE provides. Manually choosing a threshold can become a tedious task, this is a problem we are able to solve with the help of machine learning. The classifiers will receive as input 15 features. The indices used are : NDVI, MIRBI, NBR, BAI, and NBR4. But the classifier will receive the indices pre, post-fire, and their delta. The best classifier was the SVM followed closely by gmoMaxEnt, CART, continuousNaiveBayes, and randomForest. The other classifiers provided unsatisfactory results or gave a server error.

## 04_Smoothing
After analyzing the images there is a bit of noise in the classifications, so the next step would be to try to reduce it. There were two main ideas to reduce the noise they are implemented it the files that start with *04_Smoothing*.

## 04_Smoothing_Post_Classification
Applying a basic smoothing algorithm **after** the classification.
This script convolves a Gaussian kernel over the classified image in order to reduce noise.

## 04_Smoothing_Pre_Classification
Applying a basic smoothing algorithm **before** the classification with hopes to reduce noise.
This script uses a custom kernel, with 0 as the center value, that duplicates the input features in order to give the classifier information on the neighboring pixels. 

## 05_StratifiedRandomSampling
Up until this point the training data has been gathers using random sampling. This type of sampling does not ensure that every type of terrain is used for training, that lack of information may lead the classifiers to misclassify some pixels.  To solve this issue a  stratified random sampling was implemented to gather training data.

## 06_Masking_Zones
After analyzing the images we found that a part of a highway was being misclassified. Using masks to never classify certain zones, seemed like a good idea. This script only applies a mask of the highway, but it can easily be extended to mask anything. 
