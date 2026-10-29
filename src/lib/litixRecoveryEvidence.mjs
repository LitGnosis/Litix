/**
 * Source provenance is NOT a recoverable database backup.
 * Never infer database backup success from filesystem listing, git hash, ZIP,
 * Neon snapshot metadata, or a manually toggled release flag.
 * Only the protected R2 job's independent encrypted download + isolated restore
 * proves a backup is recoverable for BOTH neondb and litixapi.
 */
const validCommit=(value)=>/^[a-f0-9]{40}$/.test(String(value||""));
export function litixRecoveryEvidence(environment={}){
 const commit=String(environment.VERCEL_GIT_COMMIT_SHA||"");
 const deploymentId=String(environment.VERCEL_DEPLOYMENT_ID||"");
 const ref=String(environment.VERCEL_GIT_COMMIT_REF||"");
 return {
  source:{
   kind:"vercel_git_deployment_metadata",
   commit:validCommit(commit)?commit:null,
   branch:/^[a-z0-9_./-]{1,120}$/i.test(ref)?ref:null,
   deploymentId:/^[a-zA-Z0-9_-]{5,100}$/.test(deploymentId)?deploymentId:null,
   sourceArchiveRestorable:null,
   status:validCommit(commit)?"commit_metadata_available":"commit_metadata_unavailable"
  },
  databaseRecovery:{
   status:"NOT_INDEPENDENTLY_VERIFIED",
   requiredDatabases:["neondb","litixapi"],
   requiredChecks:["encrypted_R2_roundtrip","isolated_postgresql_restore","required_tables_readable"],
   passedChecks:[],
   localFilesystemScanCountsAsBackup:false,
   githubSourceArchiveCountsAsDatabaseBackup:false
  },
  changesAuthorizedByThisEvidence:false,
  paymentOrSupplierActionsPerformed:false
 };
}
