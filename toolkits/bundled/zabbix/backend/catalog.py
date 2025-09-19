from __future__ import annotations

from typing import Dict, List, Optional

from .models import (
    BulkExportCatalogEntry,
    BulkExportRequest,
    BulkExportSummary,
    DbScript,
    DbScriptExecutionPreview,
    DbScriptInput,
)


BULK_EXPORT_CATALOG: List[BulkExportCatalogEntry] = [
    BulkExportCatalogEntry(
        target='hosts',
        label='Hosts',
        description='Export host metadata, operational status, and mapped templates.',
        supported_formats=['json', 'csv'],
        default_format='json',
        filter_hint='Filters follow Zabbix host.get syntax. Provide a JSON object mirroring API parameters.',
        default_filters={'status': 0, 'withInventory': True, 'selectInterfaces': 'extend'},
        notes='Preview data is simulated. Execute the export job to retrieve a downloadable artifact.',
    ),
    BulkExportCatalogEntry(
        target='templates',
        label='Templates',
        description='Export template configuration with linked items and discovery rules.',
        supported_formats=['json'],
        default_format='json',
        filter_hint='Optional template IDs can be provided using a JSON array in the "templateids" property.',
        notes='Large template exports may take several minutes depending on media types.',
    ),
    BulkExportCatalogEntry(
        target='hostgroups',
        label='Host groups',
        description='Export host group hierarchy and associated host counts.',
        supported_formats=['csv', 'json'],
        default_format='csv',
        filter_hint='Provide a JSON object with "name" or "groupids" fields to scope results.',
    ),
]


_BULK_EXPORT_SAMPLE_ROWS: Dict[str, List[Dict[str, object]]] = {
    'hosts': [
        {
            'hostid': '10501',
            'host': 'core-router-1',
            'status': 'monitored',
            'interfaces': ['10.0.0.1'],
            'inventory': {'serialno_a': 'AA-12345', 'tag': 'DC-1'},
        },
        {
            'hostid': '10532',
            'host': 'db-primary-01',
            'status': 'monitored',
            'interfaces': ['10.0.5.21'],
            'inventory': {'asset_tag': 'DB-0001'},
        },
    ],
    'templates': [
        {
            'templateid': '20001',
            'name': 'Linux Server',
            'items': 128,
            'triggers': 35,
            'linkedHosts': 64,
        }
    ],
    'hostgroups': [
        {
            'groupid': '189',
            'name': 'Production/Web',
            'hosts': 42,
            'subgroups': 3,
        }
    ],
}


_BULK_EXPORT_SAMPLE_FIELDS: Dict[str, List[str]] = {
    'hosts': ['hostid', 'host', 'status', 'interfaces', 'inventory'],
    'templates': ['templateid', 'name', 'items', 'triggers', 'linkedHosts'],
    'hostgroups': ['groupid', 'name', 'hosts', 'subgroups'],
}


DB_SCRIPTS: List[DbScript] = [
    DbScript(
        key='remove_orphan_esxi_host',
        name='Remove orphan ESXi host references',
        description='Deletes orphaned VMware ESXi hosts where the inventory UUID no longer exists in vCenter.',
        category='cleanup',
        danger_level='warning',
        inputs=[
            DbScriptInput(
                name='host_uuid',
                label='Host UUID',
                type='text',
                required=True,
                placeholder='4206b1ad-1990-43c1-8bfa-a9b1cc2cfe5f',
                help_text='Provide the VMware host UUID as recorded in Zabbix inventory fields.',
            ),
            DbScriptInput(
                name='dry_run_limit',
                label='Dry run limit',
                type='text',
                required=False,
                default='10',
                help_text='Maximum number of rows to inspect during dry run preview.',
            ),
        ],
        documentation='Back up the Zabbix database before executing. The script targets rows in the hosts, interface, and inventory tables.',
    ),
    DbScript(
        key='reindex_events_partition',
        name='Rebuild event index partitions',
        description='Rebuilds and analyzes indexes for the ``events`` table to improve search performance.',
        category='maintenance',
        danger_level='info',
        inputs=[
            DbScriptInput(
                name='days',
                label='Days to include',
                type='select',
                required=True,
                options=[
                    {'value': '1', 'label': 'Last 24 hours'},
                    {'value': '7', 'label': 'Last 7 days'},
                    {'value': '30', 'label': 'Last 30 days'},
                ],
                default='7',
                help_text='Select the time range for partitions to reindex.',
            ),
            DbScriptInput(
                name='analyze',
                label='Run ANALYZE afterwards',
                type='select',
                required=True,
                options=[
                    {'value': 'true', 'label': 'Yes'},
                    {'value': 'false', 'label': 'No'},
                ],
                default='true',
            ),
        ],
        documentation='Requires elevated database privileges. Expect temporary locks on impacted partitions.',
    ),
]


_DB_SCRIPT_LOOKUP: Dict[str, DbScript] = {script.key: script for script in DB_SCRIPTS}


def get_bulk_export_catalog() -> List[BulkExportCatalogEntry]:
    return BULK_EXPORT_CATALOG


def build_bulk_export_preview(request: BulkExportRequest) -> BulkExportSummary:
    sample_fields = _BULK_EXPORT_SAMPLE_FIELDS[request.target]
    sample_rows = _BULK_EXPORT_SAMPLE_ROWS[request.target]
    estimated_records = {
        'hosts': 120,
        'templates': 18,
        'hostgroups': 35,
    }[request.target]
    return BulkExportSummary(
        target=request.target,
        format=request.format,
        estimated_records=estimated_records,
        sample_fields=sample_fields,
        sample_rows=sample_rows,
        filters_applied=request.filters or None,
        notes='Preview data is illustrative. Job execution connects to Zabbix for real data.',
    )


def get_db_scripts() -> List[DbScript]:
    return DB_SCRIPTS


def get_db_script(key: str) -> Optional[DbScript]:
    return _DB_SCRIPT_LOOKUP.get(key)


def validate_db_script_inputs(script: DbScript, inputs: Dict[str, str]) -> None:
    missing = [field.label for field in script.inputs if field.required and not inputs.get(field.name)]
    if missing:
        raise ValueError(f"Missing required inputs: {', '.join(missing)}")


def build_db_script_preview(script: DbScript, inputs: Dict[str, str]) -> DbScriptExecutionPreview:
    if script.key == 'remove_orphan_esxi_host':
        host_uuid = inputs.get('host_uuid', '').strip() or '<unknown>'
        statements = [
            'SELECT hostid FROM hosts WHERE inventory_uuid = %(host_uuid)s;',
            'DELETE FROM interface WHERE hostid = ANY(%(host_ids)s);',
            'DELETE FROM host_inventory WHERE hostid = ANY(%(host_ids)s);',
            'DELETE FROM hosts WHERE hostid = ANY(%(host_ids)s);',
        ]
        summary = (
            'Removes ESXi host records whose inventory UUID matches the provided value. '
            'Ensure the host is not managed by any current hypervisor integrations before executing.'
        )
    elif script.key == 'reindex_events_partition':
        days = inputs.get('days', '7')
        analyze = inputs.get('analyze', 'true')
        statements = [
            'CALL zabbix_catalog.rotate_event_partitions(%(days)s);',
            'REINDEX TABLE CONCURRENTLY events PARTITION FOR (%(days)s);',
        ]
        if analyze == 'true':
            statements.append('ANALYZE events;')
        summary = 'Rebuilds selected event table partitions. Expect temporary IO pressure during execution.'
    else:
        statements = ['-- Preview not available for this script; execution will run predefined stored procedure.']
        summary = 'Preview not defined for this script. Review documentation before executing.'

    return DbScriptExecutionPreview(summary=summary, statements=statements)
