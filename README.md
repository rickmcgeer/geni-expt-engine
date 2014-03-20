geni-expt-engine
================

The GENI Experiment Engine
Code to provide a simple Platform-as-a-Service offering on GENI.  

Three major services:
1. A service which instantiates PlanetLab slices over a GENI slice, creates a burner key to use them and passes the 
   credentials to the creating user
2. A service which provides a POSIX filesystem over the wide area
3. A service which provides a distributed messaging service

