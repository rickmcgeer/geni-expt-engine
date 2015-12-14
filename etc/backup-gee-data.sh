#!/bin/bash
# This should run in /tmp
cd /tmp
# Date is on the form MM-DD-YYYY
dateStr=`date +%D | sed "s/\//-/g"`
# Backup the database
# Backup file for database is dbbackup-<today's-date>.tgz
fileName=dbbackup-$dateStr.tgz
echo $fileName
# Backup database gee_master.  This will create directory dump/gee_master
mongodump --host mongodb --port 27017 -d gee_master
# Tar it up
tar -czf $fileName dump/gee_master
# Copy to the offsite backup server
scp -i /root/geni-expt-engine/.ssh/gee_rsa -o "StrictHostKeyChecking no" $fileName gee@142.104.69.88:backups
# Clean up
rm -rf dump
rm $fileName
# Backup the slice files
# Backup file for slices is slice-backup-<today's-date>.tgz
fileName=slice-backup-$dateStr.tgz
echo $fileName
# tar up /root/slice-files and copy over to the backup server
# Warning!  We are using -P to use absolute pathnames.  This is allegedly a security
# risk but it seems very small...
tar -Pczf $fileName /root/slice_files
scp -i /root/geni-expt-engine/.ssh/gee_rsa -o "StrictHostKeyChecking no" $fileName gee@142.104.69.88:backups
# clean up
rm $fileName
