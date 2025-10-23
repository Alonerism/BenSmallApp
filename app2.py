import os
import sys
import shutil
import subprocess
import traceback
from datetime import datetime

import pandas as pd
from openpyxl import load_workbook  # noqa: F401
from fuzzywuzzy import fuzz         # noqa: F401

import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from Trump28 import run_pipeline, ws_to_df, excel_first_sheet_to_df
from Trump20 import run_trump20_daily, CONFIG as DAILY_CFG

# -----------------------------
# === UI CONFIG (pro preset)
WINDOW_GEOM   = "900x680"
PREVIEW_GEOM  = "900x680"

# Font sizing
FONT_FAMILY   = "Segoe UI" if sys.platform.startswith("win") else "Helvetica"
LABEL_SIZE    = 20
FONT_MD       = (FONT_FAMILY, 16)
FONT_MD_BOLD  = (FONT_FAMILY, 16)
FONT_LG_BOLD  = (FONT_FAMILY, 20, "bold")

# Spacing & layout
PAD_X         = 12
PAD_Y         = 8
ROW_LABEL_W   = 18
ROUND_RADIUS  = 24

# Preview table tuning
TREE_ROW_H    = 26
TREE_COL_MIN  = 110
TREE_COL_MAX  = 360

EXCEL_TYPES   = [("Excel files", "*.xlsx *.xlsm"), ("All files", "*.*")]
APP_ICON_PNG  = None

# -----------------------------
# Branding + Theme (consistent after packaging)
# -----------------------------
APP_NAME = "Payroll Master"

def resource_path(rel_path: str) -> str:
    base = getattr(sys, "_MEIPASS", os.path.abspath("."))
    return os.path.join(base, rel_path)

def apply_branding(root: tk.Tk):
    root.title(APP_NAME)
    try:
        icon_png = resource_path("assets/icon.png")
        if os.path.exists(icon_png):
            img = tk.PhotoImage(file=icon_png)
            root.iconphoto(True, img)
            root._icon_ref = img  # prevent GC
    except Exception:
        pass

def apply_theme(root: tk.Tk):
    """
    Add stable widget styles without fighting your dark theme.
    - If sv_ttk dark is active, keep it.
    - Register a consistent Primary.TButton and base colors.
    """
    style = ttk.Style(root)
    current = ""
    try:
        current = style.theme_use()
    except Exception:
        pass

    if not current or "sun-valley" not in current:
        try:
            style.theme_use("clam")
        except Exception:
            pass
        root.configure(bg="#F7F7FB")
        style.configure(".", background="#F7F7FB")
    else:
        try:
            root.configure(bg=getattr(root, "BG", "#151515"))
            style.configure(".", background=getattr(root, "BG", "#151515"))
        except Exception:
            pass

    style.configure("TLabel", font=("Helvetica", 14))
    style.configure("TButton", padding=8)

    style.configure("Primary.TButton",
                    background="#2D6AE3",
                    foreground="white",
                    relief="flat")
    style.map("Primary.TButton",
              background=[("active", "#1F54B6"), ("disabled", "#9DB8F3")])

def _force_dark_theme(root):
    """Prefer sv-ttk dark; fallback to clam."""
    try:
        import sv_ttk
        sv_ttk.set_theme("dark")
    except Exception:
        try:
            style = ttk.Style(root)
            if "clam" in style.theme_names():
                style.theme_use("clam")
        except Exception:
            pass

def open_folder(path):
    if sys.platform.startswith("win"):
        os.startfile(path)  # nosec
    elif sys.platform == "darwin":
        subprocess.run(["open", path], check=False)
    else:
        subprocess.run(["xdg-open", path], check=False)

# -----------------------------
# GUI (two stacked widgets)
# -----------------------------
class App(tk.Tk):
    def __init__(self):
        super().__init__()

        # Theme/branding first so styles are ready
        _force_dark_theme(self)
        apply_branding(self)
        apply_theme(self)

        # ---- colors ----
        self.BG     = "#151515"
        self.APPBAR = "#171717"
        self.CARD   = "#1e1e1e"
        self.configure(bg=self.BG)

        # ---- CustomTkinter (optional) ----
        try:
            import customtkinter as ctk
            ctk.set_appearance_mode("dark")
            ctk.set_default_color_theme("dark-blue")
            self._ctk = ctk
            self._has_ctk = True
        except Exception:
            self._ctk = None
            self._has_ctk = False

        # ---- knobs ----
        self.ROUND_RADIUS = globals().get("ROUND_RADIUS", 22)
        self.BTN_WIDTH    = globals().get("BTN_WIDTH", 180)
        self.BTN_HEIGHT   = globals().get("BTN_HEIGHT", 44)
        self.BROWSE_WIDTH = globals().get("BROWSE_WIDTH", 120)
        self.LABEL_SIZE   = globals().get("LABEL_SIZE", 16)
        self.ROW_SPACER   = globals().get("ROW_SPACER", 24)

        # ttk base styles used across widgets
        style = ttk.Style(self)
        try:
            style.configure("TLabel", padding=(2, 1), font=FONT_MD)
            style.configure("TEntry", padding=(2, 2))
            style.configure("TButton", padding=(14, 10), font=FONT_MD)
            style.configure("Header.TLabel", font=FONT_LG_BOLD)
            style.configure("Treeview", rowheight=TREE_ROW_H, font=FONT_MD)
            style.configure("Treeview.Heading", font=FONT_MD_BOLD)
            style.configure("Picker.TLabel", font=(FONT_FAMILY, self.LABEL_SIZE), foreground="#EAEAEA")
            style.configure("Primary.TButton", padding=(18, 12), font=FONT_MD_BOLD)
        except Exception:
            pass

        # --- compact control sizes for the top (day) widget ---
        self.BTN_WIDTH_SM     = 140
        self.BTN_HEIGHT_SM    = 36
        self.BROWSE_WIDTH_SM  = 100
        self.LABEL_SIZE_SM    = max(12, self.LABEL_SIZE - 2)
        self.PAD_Y_SM         = max(4, PAD_Y // 2)

        try:
            style.configure("PickerSmall.TLabel",
                            font=(FONT_FAMILY, self.LABEL_SIZE_SM),
                            foreground="#EAEAEA")
        except Exception:
            pass

        # uniform CTk button font
        if self._has_ctk:
            self._ctk_btn_font = self._ctk.CTkFont(family=FONT_FAMILY, size=FONT_MD[1], weight="normal")
        else:
            self._ctk_btn_font = None

        # window size
        self.geometry(WINDOW_GEOM)

        # ---- run-state ----
        self._busy_day = False
        self._busy_bottom = False

        # ---- App bar ----
        self._build_appbar()

        # ---- content (vertical stack: top card, bottom card) ----
        self.content = tk.Frame(self, bg=self.BG)
        self.content.pack(fill="both", expand=True, padx=PAD_X, pady=(PAD_Y, PAD_Y))

        self.top_container = tk.Frame(self.content, bg=self.BG)
        self.top_container.pack(fill="x")

        ttk.Separator(self.content, orient="horizontal").pack(fill="x", pady=10)

        self.bottom_container = tk.Frame(self.content, bg=self.BG)
        self.bottom_container.pack(fill="x")

        # sections
        self._build_day_widget()     # TOP = by DAY (from big app's top-left)
        self._build_bottom_widget()  # BOTTOM = weekly → cash & payroll

    # ---------- header bar ----------
    def _build_appbar(self):
        if self._has_ctk:
            bar = self._ctk.CTkFrame(self, corner_radius=0, fg_color=self.APPBAR, bg_color=self.BG)
            bar.pack(fill="x", side="top")
            inner = ttk.Frame(bar, padding=(PAD_X, 10, PAD_X, 10))
            inner.pack(fill="x")
        else:
            bar = ttk.Frame(self, padding=(PAD_X, 10, PAD_X, 10))
            bar.pack(fill="x", side="top")
            inner = bar

        inner.columnconfigure(0, weight=1)
        ttk.Label(inner, text=APP_NAME, style="Header.TLabel",
                  anchor="center", justify="center").grid(row=0, column=0, sticky="ew")

    # ---------- helpers ----------
    def _card(self, parent, title_text, compact=False):
        """Rounded card with centered header + divider. Returns inner ttk.Frame."""
        if self._has_ctk:
            shell = self._ctk.CTkFrame(
                parent,
                corner_radius=self.ROUND_RADIUS,
                fg_color=self.CARD,
                bg_color=self.BG,
                border_width=1,
                border_color="#2a2a2a"
            )
        else:
            shell = ttk.Frame(parent)
            shell['borderwidth'] = 1
            shell['relief'] = 'solid'

        shell.pack(fill="x", padx=PAD_X, pady=(PAD_Y, PAD_Y))

        pad_y = self.PAD_Y_SM if compact else PAD_Y
        inner = ttk.Frame(shell, padding=(PAD_X, pad_y, PAD_X, pad_y))
        inner.pack(fill="x", expand=True)

        ttk.Label(inner, text=title_text, style="Header.TLabel", anchor="center").pack(fill="x")
        ttk.Separator(inner, orient="horizontal").pack(fill="x", pady=(6, pad_y))
        return inner

    def _btn(self, parent, text, command, primary=False, width=None, height=None, font=None):
        w = width if width is not None else self.BTN_WIDTH
        h = height if height is not None else self.BTN_HEIGHT
        if self._has_ctk:
            b = self._ctk.CTkButton(
                parent, text=text, command=command,
                width=w, height=h, corner_radius=self.ROUND_RADIUS,
                bg_color=self.CARD, font=(font or self._ctk_btn_font)
            )
            b.pack_propagate(False)
            return b
        else:
            b = ttk.Button(parent, text=text,
                           style="Primary.TButton" if primary else "TButton",
                           command=command)
            b.config(width=max(8, int(w / 9)))
            return b

    def _picker_row(self, parent, label, var, *,
                    label_style="Picker.TLabel",
                    browse_width=None,
                    pad_y=None,
                    label_width=None):
        frm = ttk.Frame(parent)
        frm.pack(fill="x", padx=0, pady=(pad_y if pad_y is not None else PAD_Y))

        frm.columnconfigure(0, weight=0)
        frm.columnconfigure(1, weight=1)
        frm.columnconfigure(2, minsize=self.ROW_SPACER, weight=0)
        frm.columnconfigure(3, weight=0)

        ttk.Label(frm, text=label, width=(label_width or ROW_LABEL_W), anchor="w",
                  style=label_style).grid(row=0, column=0, sticky="w")

        ttk.Entry(frm, textvariable=var).grid(row=0, column=1, sticky="ew", padx=(8, 0))

        tk.Frame(frm, width=self.ROW_SPACER, height=1, bg=self.CARD).grid(row=0, column=2, sticky="e")

        def choose():
            p = filedialog.askopenfilename(title=f"Select {label}", filetypes=EXCEL_TYPES)
            if p:
                var.set(p)
        bw = (browse_width if browse_width is not None else self.BROWSE_WIDTH)
        self._btn(frm, "Browse", choose, width=bw, height=self.BTN_HEIGHT_SM).grid(row=0, column=3)

    # ---------- DAY CARD (TOP) ----------
    def _build_day_widget(self):
        card = self._card(self.top_container, "Raw to Weekly by DAY", compact=True)

        self.daily_raw_var   = tk.StringVar()
        self.weekly_ts_var   = tk.StringVar()
        self.day_last_report = None

        self._picker_row(card, "Daily Raw",        self.daily_raw_var,
                         label_style="PickerSmall.TLabel",
                         browse_width=self.BROWSE_WIDTH_SM,
                         pad_y=self.PAD_Y_SM,
                         label_width=16)

        self._picker_row(card, "Weekly TimeSheet", self.weekly_ts_var,
                         label_style="PickerSmall.TLabel",
                         browse_width=self.BROWSE_WIDTH_SM,
                         pad_y=self.PAD_Y_SM,
                         label_width=16)

        btns = ttk.Frame(card); btns.pack(pady=self.PAD_Y_SM)
        self.btn_day_save    = self._btn(btns, "Save",    self.on_save_day,
                                         primary=True, width=self.BTN_WIDTH_SM, height=self.BTN_HEIGHT_SM)
        self.btn_day_save.pack(side="left", padx=6)
        self.btn_day_preview = self._btn(btns, "Preview", self.on_preview_day,
                                         primary=True, width=self.BTN_WIDTH_SM, height=self.BTN_HEIGHT_SM)
        self.btn_day_preview.pack(side="left", padx=6)

        self.day_progress = ttk.Progressbar(card, mode="indeterminate")

    def _set_day_busy(self, busy: bool):
        try:
            state = "disabled" if busy else "normal"
            self.btn_day_save.configure(state=state)
            self.btn_day_preview.configure(state=state)
        except Exception:
            pass

    def _validate_paths_day(self):
        daily_raw = self.daily_raw_var.get().strip()
        weekly_ts = self.weekly_ts_var.get().strip()
        if not (daily_raw and weekly_ts):
            messagebox.showerror("Missing files", "Please choose both Daily Raw and Weekly TimeSheet.")
            return None
        for p in [daily_raw, weekly_ts]:
            if not os.path.exists(p):
                messagebox.showerror("File not found", f"Cannot find:\n{p}")
                return None
        return daily_raw, weekly_ts

    def on_preview_day(self):
        if getattr(self, "_busy_day", False):
            return
        vals = self._validate_paths_day()
        if not vals:
            return
        daily_raw, weekly_ts = vals
        self._busy_day = True
        try:
            self._set_day_busy(True)
            self.day_progress.pack(fill="x", pady=(0, PAD_Y))
            self.day_progress.start(12)
            self.update_idletasks()

            # temp preview copy so we don't modify the real file
            base, ext = os.path.splitext(weekly_ts)
            preview_ts = f"{base}__PREVIEW__{ext}"
            shutil.copyfile(weekly_ts, preview_ts)

            res = run_trump20_daily(
                raw_times_path=daily_raw,
                weekly_template_path=preview_ts,
                **DAILY_CFG
            )

            previews = []
            if res.name_matching is not None and not res.name_matching.empty:
                previews.append(("Preview: Name Matching (Daily)", res.name_matching))
            if res.review_df is not None and not res.review_df.empty:
                previews.append(("Preview: Daily Review Queue", res.review_df))
            if res.daily_long is not None and not res.daily_long.empty:
                df = res.daily_long.copy()
                df["RawHours_str"]     = df["RawHours"].apply(lambda x: x if pd.isna(x) else f"{int(x)}:{int(round((x%1)*60)):02d}")
                df["RoundedHours_str"] = df["RoundedHours"].apply(lambda x: x if pd.isna(x) else f"{int(x)}:{int(round((x%1)*60)):02d}")
                previews.append(("Preview: Daily Totals (HH:MM)", df))

            for title, df in previews[::-1]:
                self._show_df(title, df)

            messagebox.showinfo(
                "Preview ready",
                f"Previewed updates for {res.report_date.strftime('%m/%d/%Y')}.\n\n"
                f"(A temporary preview workbook was created and will be removed now.)"
            )
            try:
                os.remove(preview_ts)
            except Exception:
                pass

            self.day_last_report = {"daily_path": daily_raw, "weekly_ts_path": weekly_ts}

        except Exception as e:
            messagebox.showerror("Error", f"Preview failed:\n{e}\n\nDetails:\n{traceback.format_exc()}")
        finally:
            self.day_progress.stop()
            self.day_progress.pack_forget()
            self._set_day_busy(False)
            self._busy_day = False

    def on_save_day(self):
        if getattr(self, "_busy_day", False):
            return
        vals = self._validate_paths_day()
        if not vals:
            return
        daily_raw, weekly_ts = vals
        self._busy_day = True
        try:
            self._set_day_busy(True)
            self.day_progress.pack(fill="x", pady=(0, PAD_Y))
            self.day_progress.start(12)
            self.update_idletasks()

            res = run_trump20_daily(
                raw_times_path=daily_raw,
                weekly_template_path=weekly_ts,
                **DAILY_CFG
            )

            if not res.output_path:
                raise RuntimeError("No output file was produced by the daily updater.")

            msg = (
                "Saved!\n\n"
                f"Updated date: {res.report_date.strftime('%a %m/%d/%Y')}\n"
                f"Output → {res.output_path}\n\n"
                f"{res.secretary_message}"
            )
            messagebox.showinfo("Success", msg)

            if messagebox.askyesno("Open folder?", "Open the output folder now?"):
                open_folder(os.path.dirname(res.output_path))

        except Exception as e:
            messagebox.showerror("Error", f"Save failed:\n{e}\n\nDetails:\n{traceback.format_exc()}")
        finally:
            self.day_progress.stop()
            self.day_progress.pack_forget()
            self._set_day_busy(False)
            self._busy_day = False

    # ---------- BOTTOM CARD ----------
    def _build_bottom_widget(self):
        card = self._card(self.bottom_container, "Weekly → Cash & Payroll")

        self.weekly_var  = tk.StringVar()
        self.cash_var    = tk.StringVar()
        self.payroll_var = tk.StringVar()
        self.reimb_var   = tk.StringVar()
        self.loans_var   = tk.StringVar()   # NEW
        self.last_report = None

        self._picker_row(card, "Weekly Hours",  self.weekly_var)
        self._picker_row(card, "Cash file",     self.cash_var)
        self._picker_row(card, "Payroll file",  self.payroll_var)
        self._picker_row(card, "Reimb & Bonus", self.reimb_var)
        self._picker_row(card, "Loans file",    self.loans_var)  # NEW

        btns = ttk.Frame(card); btns.pack(pady=PAD_Y)
        self.btn_bot_save    = self._btn(btns, "Save",    self.on_save_bottom, primary=True)
        self.btn_bot_save.pack(side="left", padx=6)
        self.btn_bot_preview = self._btn(btns, "Preview", self.on_preview_bottom, primary=True)
        self.btn_bot_preview.pack(side="left", padx=6)

        self.progress = ttk.Progressbar(card, mode="indeterminate")

    def _validate_paths_bottom(self):
        weekly, cash, payroll, reimb, loans = (
            self.weekly_var.get().strip(),
            self.cash_var.get().strip(),
            self.payroll_var.get().strip(),
            self.reimb_var.get().strip(),
            self.loans_var.get().strip(),
        )
        if not all([weekly, cash, payroll, reimb, loans]):
            messagebox.showerror("Missing files", "Please choose all five input files.")
            return None
        for p in [weekly, cash, payroll, reimb, loans]:
            if not os.path.exists(p):
                messagebox.showerror("File not found", f"Cannot find:\n{p}")
                return None
        return weekly, cash, payroll, reimb, loans

    def on_preview_bottom(self):
        if self._busy_bottom:
            return
        vals = self._validate_paths_bottom()
        if not vals:
            return
        weekly, cash, payroll, reimb, loans = vals
        self.progress.pack(fill="x", pady=(0, PAD_Y)); self.progress.start(12); self.update_idletasks()
        self._set_bottom_busy(True)
        try:
            # Preview does NOT save; loans workbook won't be modified on disk here.
            report = run_pipeline(weekly, cash, payroll, reimb, save=False, loans_path=loans)
            self.last_report = report
            df_cash    = ws_to_df(report["wb_reg"].active)
            df_payroll = ws_to_df(report["wb_ot"].active)
            if df_cash is not None and not df_cash.empty:
                self._show_df("Preview: Cash", df_cash)
            if df_payroll is not None and not df_payroll.empty:
                self._show_df("Preview: Payroll", df_payroll)
        except Exception as e:
            messagebox.showerror("Error", f"Preview failed:\n{e}\n\nDetails:\n{traceback.format_exc()}")
        finally:
            self.progress.stop(); self.progress.pack_forget()
            self._set_bottom_busy(False)

    def on_save_bottom(self):
        if self._busy_bottom:
            return
        vals = self._validate_paths_bottom()
        if not vals:
            return

        weekly, cash, payroll, reimb, loans = vals
        self.progress.pack(fill="x", pady=(0, PAD_Y))
        self.progress.start(12)
        self.update_idletasks()
        self._set_bottom_busy(True)

        try:
            # Run pipeline and write outputs; Loans.xlsx updated in-place.
            result = run_pipeline(weekly, cash, payroll, reimb, save=True, loans_path=loans)

            # Optional: also create a timestamped copy of the updated Loans workbook
            loans_copy_path = None
            if "wb_loans" in result and result["wb_loans"] is not None:
                date_suffix = datetime.now().strftime("%m.%d.%y")
                loans_dir   = os.path.dirname(loans) or os.getcwd()
                base, ext   = os.path.splitext(os.path.basename(loans))
                loans_copy_path = os.path.join(loans_dir, f"{base}_Updated_{date_suffix}{ext}")
                try:
                    result["wb_loans"].save(loans_copy_path)
                except Exception as e:
                    loans_copy_path = f"Failed to create copy: {e}"

            # Group unmatched names (BOTH → Payroll → Cash)
            both_missing = []
            only_payroll = []
            only_cash = []
            for item in (result.get("unmatched_reports") or []):
                nm = str(item.get("name", "")).strip()
                missing = set(item.get("missing", []))
                if not nm:
                    continue
                if {"Cash", "Payroll"}.issubset(missing):
                    both_missing.append(nm)
                elif "Payroll" in missing:
                    only_payroll.append(nm)
                elif "Cash" in missing:
                    only_cash.append(nm)

            # Pull other fields
            counts         = result.get("counts", {})
            bonus_summary  = result.get("bonus_summary", {})
            loan_notes     = result.get("loan_notes", [])
            cash_output    = result.get("cash_output")
            payroll_output = result.get("payroll_output")

            # Build popup message (identical to big app)
            lines = ["Saved!", ""]

            if both_missing:
                lines += ["Not found in BOTH:",
                        *[f"• {n} not found in: Payroll, Cash" for n in both_missing],
                        ""]
            if only_cash:
                lines += ["Not found in Cash:",
                        *[f"• {n} not found in: Cash" for n in only_cash],
                        ""]

            lines += [
                f"Cash → {cash_output}",
                f"Payroll → {payroll_output}",
                "",
                f"Sick entries: {counts.get('sick_entries', 0)}",
                f"Loans processed: {counts.get('loans_processed', 0)} | Loans closed: {counts.get('loans_closed', 0)}",
                f"Bonus: total_yards {bonus_summary.get('total_yards', 0)}, foremen {bonus_summary.get('num_foremen', 0)}",
            ]

            if loan_notes:
                lines += ["", "Loan edge cases:"]
                MAX_NOTES = 10
                shown = loan_notes[:MAX_NOTES]
                lines += [f"• {n}" for n in shown]
                if len(loan_notes) > MAX_NOTES:
                    lines += [f"(+{len(loan_notes) - MAX_NOTES} more)"]

            lines += ["", f"Loans updated in place → {loans}"]
            if loans_copy_path:
                lines += [f"Loans timestamped copy → {loans_copy_path}"]

            msg = "\n".join(lines)
            messagebox.showinfo("Success", msg)

            # Open folders (cross-platform via open_folder helper)
            if messagebox.askyesno("Open folder?", "Open the Payroll/Cash output folder now?"):
                open_folder(os.path.dirname(cash_output))
            if loans_copy_path and "Failed" not in str(loans_copy_path):
                if messagebox.askyesno("Open Loans folder?", "Open the Loans folder now?"):
                    open_folder(os.path.dirname(loans_copy_path))

        except Exception as e:
            messagebox.showerror("Error", f"Save failed:\n{e}\n\nDetails:\n{traceback.format_exc()}")
        finally:
            self.progress.stop()
            self.progress.pack_forget()
            self._set_bottom_busy(False)

    def _set_bottom_busy(self, busy: bool):
        self._busy_bottom = busy
        try:
            state = "disabled" if busy else "normal"
            self.btn_bot_save.configure(state=state)
            self.btn_bot_preview.configure(state=state)
        except Exception:
            pass

    # ---------- preview table (must be a TOP-LEVEL method, not nested) ----------
    def _show_df(self, title, df: pd.DataFrame):
        if df is None or (isinstance(df, pd.DataFrame) and df.empty):
            messagebox.showinfo(title, "No rows to display.")
            return

        win = tk.Toplevel(self)
        win.title(title)
        win.geometry(PREVIEW_GEOM)

        frame = ttk.Frame(win)
        frame.pack(fill='both', expand=True)

        columns = [str(c) for c in df.columns]
        tree = ttk.Treeview(frame, columns=columns, show="headings")
        tree.configure(selectmode="browse")

        for c in columns:
            tree.heading(c, text=c)
            try:
                sample = df[c].astype(str).head(200)
                avg_len = int(sample.str.len().mean() or 10)
            except Exception:
                avg_len = 10
            width = max(TREE_COL_MIN, min(TREE_COL_MAX, avg_len * 9))
            tree.column(c, width=width, anchor="w")

        vsb = ttk.Scrollbar(frame, orient="vertical", command=tree.yview)
        hsb = ttk.Scrollbar(frame, orient="horizontal", command=tree.xview)
        tree.configure(yscroll=vsb.set, xscroll=hsb.set)

        tree.grid(row=0, column=0, sticky="nsew")
        vsb.grid(row=0, column=1, sticky="ns")
        hsb.grid(row=1, column=0, sticky="ew")
        frame.rowconfigure(0, weight=1)
        frame.columnconfigure(0, weight=1)

        CHUNK = 1000 if len(df) > 5000 else 500
        rows = df.to_dict(orient="records")
        total = len(rows)

        def insert_chunk(start_idx=0):
            end_idx = min(start_idx + CHUNK, total)
            for i in range(start_idx, end_idx):
                row = rows[i]
                vals = []
                for c in columns:
                    v = row.get(c, "")
                    if pd.isna(v):
                        v = ""
                    vals.append(v)
                tree.insert("", "end", values=vals)
            if end_idx < total:
                self.after(1, lambda: insert_chunk(end_idx))

        insert_chunk(0)

        footer = ttk.Label(win, text=f"Rows: {len(df):,}   Columns: {len(columns)}", anchor="w")
        footer.pack(fill="x", padx=8, pady=6)


if __name__ == "__main__":
    app = App()
    app.mainloop()
