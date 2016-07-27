#!/bin/bash
# test add-node.py
echo 'too few arguments validation error'
./add-node.py 
echo 'too many arguments validation error'
./add-node.py 1 2 3 4 5
echo 'Bad IP: too many fields'
./add-node.py 1.2.3.4.5 a b c
echo 'Bad IP: too few fields'
./add-node.py 1.2.3 a b c
echo 'Bad IP: non-numeric field'
./add-node.py 1.a.3.4 a b c
echo 'Bad IP: negative field'
./add-node.py 1.-1.3.4 a b c
echo 'Bad IP: negative field'
./add-node.py 1.256.3.4 a b c
echo 'Good IP: corner case'
./add-node.py 0.0.0.0 a b c
echo 'Good IP: corner case'
./add-node.py 255.255.255.255 a b c
echo 'Bad DNS: Bad first digit'
./add-node.py 255.255.255.255 a 0b c
echo 'Bad DNS: Bad subsequent digit'
./add-node.py 255.255.255.255 a b= c
echo 'Bad ssh Nickname: Bad subsequent digit'
./add-node.py 255.255.255.255 a b_- 0c
echo 'Bad ssh Nickname: Bad subsequent digit'
./add-node.py 255.255.255.255 a b_- c+
echo 'OK.  node should be 255.255.255.255, b_-.gee-project.net, c4'
./add-node.py 255.255.255.255 a b_- c4



