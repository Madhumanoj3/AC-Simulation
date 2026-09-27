from django.db import models
from django.utils import timezone


class RefrigerationTelemetry(models.Model):
    """
    Stores machine performance telemetry for the 4-component refrigeration cycle:
    Compressor -> Condenser -> Capillary Tube -> Evaporator.
    """
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    # Pressures (bar)
    suction_pressure = models.FloatField(help_text="Compressor suction pressure in bar")
    discharge_pressure = models.FloatField(help_text="Compressor discharge pressure in bar")

    # Temperatures (°C)
    discharge_temperature = models.FloatField(help_text="Compressor discharge / condenser inlet temperature in °C")
    condenser_outlet_temp = models.FloatField(help_text="Condenser outlet / expansion inlet temperature in °C")
    evaporator_inlet_temp = models.FloatField(help_text="Expansion outlet / evaporator inlet temperature in °C")
    evaporator_outlet_temp = models.FloatField(help_text="Evaporator outlet / suction line temperature in °C")

    # Component & Machine operational status
    compressor_status = models.CharField(max_length=30, default="OFF", help_text="RUNNING / STARTING / STOPPED / OFF")
    condenser_fan_status = models.CharField(max_length=30, default="IDLE", help_text="ACTIVE / IDLE / OFF")
    evaporator_fan_status = models.CharField(max_length=30, default="IDLE", help_text="ACTIVE / IDLE / OFF")
    system_status = models.CharField(max_length=30, default="STOPPED", help_text="RUNNING / STARTING / STOPPED")

    # Fault diagnostics
    fault_type = models.CharField(max_length=100, blank=True, null=True, default="None", help_text="Active fault description if any")

    class Meta:
        db_table = "refrigeration_telemetry"
        ordering = ["timestamp"]
        indexes = [
            models.Index(fields=["timestamp"]),
        ]

    def __str__(self):
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] P_suc={self.suction_pressure}bar, P_dis={self.discharge_pressure}bar, Status={self.system_status}"

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "time_display": self.timestamp.strftime("%H:%M:%S"),
            "date_display": self.timestamp.strftime("%Y-%m-%d"),
            "suction_pressure": round(self.suction_pressure, 2),
            "discharge_pressure": round(self.discharge_pressure, 2),
            "discharge_temperature": round(self.discharge_temperature, 2),
            "condenser_outlet_temp": round(self.condenser_outlet_temp, 2),
            "evaporator_inlet_temp": round(self.evaporator_inlet_temp, 2),
            "evaporator_outlet_temp": round(self.evaporator_outlet_temp, 2),
            "compressor_status": self.compressor_status,
            "condenser_fan_status": self.condenser_fan_status,
            "evaporator_fan_status": self.evaporator_fan_status,
            "system_status": self.system_status,
            "fault_type": self.fault_type or "None",
        }

