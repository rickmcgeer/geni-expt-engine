from beanstalk_config import *
def num_outstanding_jobs():
    result = {}
    for tube in beanstalk.watching():
        tube_stats = beanstalk.stats_tube(tube)
        result[tube] = tube_stats['current-jobs-ready']
    return result

def default_outstanding_jobs():
    my_tubes = beanstalk.watching()
    tube = 'default'
    if (len(my_tubes) > 0): tube = my_tubes[1]
    jobs = num_outstanding_jobs()
    return jobs[tube]
