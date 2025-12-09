namespace FileManagement.Common
{
    public enum UploadSessionStatus
    {
        Created = 1,
        InProgress = 2,
        Paused = 3,
        Completed = 4,
        Failed = 5,
        Cancelled = 6,
        Expired = 7
    }
}