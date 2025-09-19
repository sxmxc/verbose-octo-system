from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class UserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=8)
    email: Optional[str] = Field(default=None)
    display_name: Optional[str] = Field(default=None)
    roles: List[str] = Field(default_factory=list)
    is_superuser: bool = False


class UserUpdateRequest(BaseModel):
    email: Optional[str] = None
    display_name: Optional[str] = None
    roles: Optional[List[str]] = None
    is_superuser: Optional[bool] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str]
    display_name: Optional[str]
    roles: List[str]
    is_superuser: bool
    is_active: bool


class ImportedUserEntry(BaseModel):
    external_id: str = Field(..., description="External subject identifier")
    username: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    roles: List[str] = Field(default_factory=list)


class UserImportRequest(BaseModel):
    provider: str
    entries: List[ImportedUserEntry]
