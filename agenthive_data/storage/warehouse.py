"""
DuckDB Analytical Engine Wrapper.
Provides analytical query execution over Medallion Parquet files, longitudinal performance panels, and CECL survival streams.
"""

from pathlib import Path
from typing import List, Dict, Any, Optional
import pandas as pd
import sqlite3

try:
    import duckdb
    DUCKDB_AVAILABLE = True
except ImportError:
    DUCKDB_AVAILABLE = False

from agenthive_data.config import config


class AnalyticalWarehouse:
    """Embedded Analytical Warehouse wrapper executing DuckDB SQL queries over local Parquet stores."""

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or config.DUCKDB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    def get_connection(self):
        """Returns DuckDB connection or SQLite fallback connection."""
        if DUCKDB_AVAILABLE:
            return duckdb.connect(str(self.db_path))
        conn = sqlite3.connect(str(config.SQLITE_PATH))
        return conn

    def query_parquet(self, parquet_path: Path, sql_query: str) -> pd.DataFrame:
        """Executes analytical SQL directly against Parquet file using DuckDB."""
        if DUCKDB_AVAILABLE:
            conn = duckdb.connect()
            # Replace placeholder in query if provided
            query = sql_query.replace("{parquet_file}", str(parquet_path))
            df = conn.execute(query).df()
            conn.close()
            return df
        else:
            # Fallback using pandas read_parquet + sqlite in-memory
            df_raw = pd.read_parquet(parquet_path)
            conn = sqlite3.connect(":memory:")
            df_raw.to_sql("parquet_table", conn, index=False)
            query = sql_query.replace("read_parquet('{parquet_file}')", "parquet_table")
            query = query.replace("{parquet_file}", "parquet_table")
            result = pd.read_sql_query(query, conn)
            conn.close()
            return result

    def register_dataframe(self, table_name: str, df: pd.DataFrame):
        """Registers a pandas DataFrame as a queryable table in DuckDB."""
        if DUCKDB_AVAILABLE:
            conn = self.get_connection()
            conn.register(table_name, df)
            conn.close()

    def execute_sql(self, query: str) -> pd.DataFrame:
        """Executes raw SQL query on warehouse."""
        conn = self.get_connection()
        if DUCKDB_AVAILABLE:
            df = conn.execute(query).df()
            conn.close()
            return df
        else:
            df = pd.read_sql_query(query, conn)
            conn.close()
            return df
