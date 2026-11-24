from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, FiniteFloat, model_validator, field_validator

Name = Annotated[str, Field(min_length=1, max_length=120, pattern=r'\S')]
Source = Literal['simulated', 'device']
ParameterName = Literal['temp', 'ph', 'do', 'ec', 'turb']
UNITS = {'temp': 'degC', 'ph': '1', 'do': 'mg/L', 'ec': 'uS/cm', 'turb': 'NTU'}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


class MissionIn(StrictModel):
    id: UUID
    name: Name
    source: Source


class Position(StrictModel):
    latitude: Annotated[FiniteFloat, Field(ge=-90, le=90)] | None = None
    longitude: Annotated[FiniteFloat, Field(ge=-180, le=180)] | None = None
    accuracy_m: Annotated[FiniteFloat, Field(ge=0)] | None = None
    local_x_m: FiniteFloat | None = None
    local_north_m: FiniteFloat | None = None
    reference_id: Name | None = None

    @model_validator(mode='after')
    def complete_coordinates(self):
        geo = [self.latitude, self.longitude]
        local = [self.local_x_m, self.local_north_m, self.reference_id]
        if any(v is not None for v in geo) and not all(v is not None for v in geo):
            raise ValueError('latitude and longitude must be provided together')
        if any(v is not None for v in local) and not all(v is not None for v in local):
            raise ValueError('local coordinates require reference_id')
        if self.latitude is None and self.local_x_m is None:
            raise ValueError('a geographic or local position is required')
        if self.accuracy_m is not None and self.latitude is None:
            raise ValueError('accuracy_m requires GNSS coordinates')
        return self


class Parameter(StrictModel):
    value: FiniteFloat
    unit: str
    sensor_id: Name


def check_units(parameters):
    for key, parameter in parameters.items():
        if parameter.unit != UNITS[key]:
            raise ValueError(f'{key} requires unit {UNITS[key]}')
    return parameters


class RawSample(StrictModel):
    offset_s: Annotated[FiniteFloat, Field(ge=0)]
    parameters: dict[ParameterName, Parameter] = Field(min_length=1, max_length=5)
    _units = field_validator('parameters')(check_units)


class MeasurementIn(StrictModel):
    schema_version: Literal[1]
    id: UUID
    mission_id: UUID
    device_id: Name
    station_id: Name
    source: Source
    measured_at: AwareDatetime
    target_depth_m: Annotated[FiniteFloat, Field(ge=0)]
    actual_depth_m: Annotated[FiniteFloat, Field(ge=0)]
    position: Position
    parameters: dict[ParameterName, Parameter] = Field(min_length=1, max_length=5)
    quality: Literal['unreviewed', 'valid', 'unstable', 'invalid']
    quality_reason: Annotated[str, Field(min_length=1, max_length=1000, pattern=r'\S')]
    calibration_id: Name | None = None
    raw_samples: list[RawSample] = Field(default_factory=list, max_length=1000)
    _units = field_validator('parameters')(check_units)

    @field_validator('measured_at')
    @classmethod
    def utc_time(cls, value: datetime):
        return value.astimezone(timezone.utc)

    @model_validator(mode='after')
    def raw_consistency(self):
        offsets = [sample.offset_s for sample in self.raw_samples]
        if offsets != sorted(offsets) or len(offsets) != len(set(offsets)):
            raise ValueError('raw sample offsets must be strictly increasing')
        for sample in self.raw_samples:
            for key, parameter in sample.parameters.items():
                if key not in self.parameters or parameter.sensor_id != self.parameters[key].sensor_id:
                    raise ValueError('raw parameters must match the measurement sensor identity')
        return self
