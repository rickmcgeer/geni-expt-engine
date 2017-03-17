import geni.util
import geni.aggregate.instageni as IG
import geni.aggregate.exogeni as EG
import pprint 
import datetime

# Begin copied text


#EXOSM = EGCompute("exosm", "geni.renci.org")
#GPO = EGCompute("eg-gpo", "bbn-hn.exogeni.net")
#RCI = EGCompute("eg-rci", "rci-hn.exogeni.net")
#FIU = EGCompute("eg-fiu", "fiu-hn.exogeni.net")
#UH = EGCompute("eg-uh", "uh-hn.exogeni.net")
#NCSU = EGCompute("eg-ncsu", "ncsu-hn.exogeni.net")
#UFL = EGCompute("eg-ufl", "ufl-hn.exogeni.net")
#OSF = EGCompute("eg-osf", "osf-hn.exogeni.net")
#UCD = EGCompute("eg-ucd", "ucd-hn.exogeni.net")
#NICTA = EGCompute("eg-nicta", "nicta-hn.exogeni.net")
#SL = EGCompute("eg-sl", "sl-hn.exogeni.net")
#TAMU = EGCompute("eg-tamu", "tamu-hn.exogeni.net")
#WVN = EGCompute("eg-wvn", "wvn-hn.exogeni.net")
#WSU = EGCompute("eg-wsu", "wsu-hn.exogeni.net")

#End copied text

context=geni.util.loadContext()
date = (datetime.datetime.now() + datetime.timedelta(days=14))
pprint.pprint(EG.TAMU.renewsliver(context,"PlanetIgnite",date))
pprint.pprint(EG.GPO.renewsliver(context,"PlanetIgnite",date))
#pprint.pprint(EG.TAMU.sliverstatus(context,"PlanetIgnite"))
#pprint.pprint(EG.GPO.getversion(context))
