"""Deterministic capacity planning for owned, verified first-party compute and QA."""
from __future__ import annotations
from dataclasses import asdict,dataclass
from math import floor
import json
import os

@dataclass(frozen=True)
class CapacityEstimate:
    owned_nodes: int
    protected_slots: int
    expected_jobs_per_hour: int
    modeled_jobs_per_week: int
    theoretical_jobs_per_hour: int
    assumptions: str

def estimate(*,owned_nodes:int,jobs_per_node:int,seconds_per_job:float,
             uptime:float=0.95,reserve:float=0.25)->CapacityEstimate:
    if (isinstance(owned_nodes,bool) or isinstance(jobs_per_node,bool) or
        not isinstance(owned_nodes,int) or not isinstance(jobs_per_node,int) or
        not 0<=owned_nodes<=100000 or not 1<=jobs_per_node<=128 or
        not 0<seconds_per_job<=86400 or not 0<uptime<=1 or not 0<=reserve<1):
        raise ValueError("invalid_capacity_assumptions")
    theoretical=owned_nodes*jobs_per_node
    protected=floor(theoretical*(1-reserve))
    per_hour=floor(protected*3600/seconds_per_job*uptime)
    return CapacityEstimate(owned_nodes,protected,per_hour,per_hour*168,
                            floor(theoretical*3600/seconds_per_job),
                            "Illustrative first-party throughput only; not actual sales or social engagement")
if __name__=="__main__":
    print(json.dumps(asdict(estimate(owned_nodes=int(os.getenv("LITIX_SIM_NODES","0")),
         jobs_per_node=int(os.getenv("LITIX_SIM_PARALLEL","1")),
         seconds_per_job=float(os.getenv("LITIX_SIM_SECONDS","120")))),indent=2))
