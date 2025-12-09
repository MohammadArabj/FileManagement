using System;

namespace FileManagement.Infrastructure.Query.Contracts;

public class UserViewModel
{
    public Guid Guid { get; set; }
    public string Fullname { get; set; }
}